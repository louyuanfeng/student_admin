/*!
 * BootstrapValidator (http://bootstrapvalidator.com)
 * The best jQuery plugin to validate form fields. Designed to use with Bootstrap 3
 *
 * @version     v0.5.3, built on 2014-11-05 9:14:18 PM
 * @author      https://twitter.com/nghuuphuoc
 * @copyright   (c) 2013 - 2014 Nguyen Huu Phuoc
 * @license     Commercial: http://bootstrapvalidator.com/license/
 *              Non-commercial: http://creativecommons.org/licenses/by-nc-nd/3.0/
 */
if (typeof jQuery === 'undefined') {
  throw new Error('BootstrapValidator requires jQuery');
}

(function($) {
  var version = $.fn.jquery.split(' ')[0].split('.');
  if ((+version[0] < 2 && +version[1] < 9) || (+version[0] === 1 && +version[1] === 9 && +version[2] < 1)) {
      throw new Error('BootstrapValidator requires jQuery version 1.9.1 or higher');
  }
}(window.jQuery));

(function($) {
  var BootstrapValidator = function(form, options) {
      this.$form   = $(form);
      this.options = $.extend({}, $.fn.bootstrapValidator.DEFAULT_OPTIONS, options);

      this.$invalidFields = $([]);    // Array of invalid fields
      this.$submitButton  = null;     // The submit button which is clicked to submit form
      this.$hiddenButton  = null;

      // Validating status
      this.STATUS_NOT_VALIDATED = 'NOT_VALIDATED';
      this.STATUS_VALIDATING    = 'VALIDATING';
      this.STATUS_INVALID       = 'INVALID';
      this.STATUS_VALID         = 'VALID';

      // Determine the event that is fired when user change the field value
      // Most modern browsers supports input event except IE 7, 8.
      // IE 9 supports input event but the event is still not fired if I press the backspace key.
      // Get IE version
      // https://gist.github.com/padolsey/527683/#comment-7595
      var ieVersion = (function() {
          var v = 3, div = document.createElement('div'), a = div.all || [];
          while (div.innerHTML = '<!--[if gt IE '+(++v)+']><br><![endif]-->', a[0]) {}
          return v > 4 ? v : !v;
      }());

      var el = document.createElement('div');
      this._changeEvent = (ieVersion === 9 || !('oninput' in el)) ? 'keyup' : 'input';

      // The flag to indicate that the form is ready to submit when a remote/callback validator returns
      this._submitIfValid = null;

      // Field elements
      this._cacheFields = {};

      this._init();
  };

  BootstrapValidator.prototype = {
      constructor: BootstrapValidator,

      /**
       * Init form
       */
      _init: function() {
          var that    = this,
              options = {
                  autoFocus:      this.$form.attr('data-bv-autofocus'),
                  container:      this.$form.attr('data-bv-container'),
                  events: {
                      formInit:         this.$form.attr('data-bv-events-form-init'),
                      formError:        this.$form.attr('data-bv-events-form-error'),
                      formSuccess:      this.$form.attr('data-bv-events-form-success'),
                      fieldAdded:       this.$form.attr('data-bv-events-field-added'),
                      fieldRemoved:     this.$form.attr('data-bv-events-field-removed'),
                      fieldInit:        this.$form.attr('data-bv-events-field-init'),
                      fieldError:       this.$form.attr('data-bv-events-field-error'),
                      fieldSuccess:     this.$form.attr('data-bv-events-field-success'),
                      fieldStatus:      this.$form.attr('data-bv-events-field-status'),
                      validatorError:   this.$form.attr('data-bv-events-validator-error'),
                      validatorSuccess: this.$form.attr('data-bv-events-validator-success')
                  },
                  excluded:       this.$form.attr('data-bv-excluded'),
                  feedbackIcons: {
                      valid:      this.$form.attr('data-bv-feedbackicons-valid'),
                      invalid:    this.$form.attr('data-bv-feedbackicons-invalid'),
                      validating: this.$form.attr('data-bv-feedbackicons-validating')
                  },
                  group:          this.$form.attr('data-bv-group'),
                  live:           this.$form.attr('data-bv-live'),
                  message:        this.$form.attr('data-bv-message'),
                  onError:        this.$form.attr('data-bv-onerror'),
                  onSuccess:      this.$form.attr('data-bv-onsuccess'),
                  submitButtons:  this.$form.attr('data-bv-submitbuttons'),
                  threshold:      this.$form.attr('data-bv-threshold'),
                  trigger:        this.$form.attr('data-bv-trigger'),
                  verbose:        this.$form.attr('data-bv-verbose'),
                  fields:         {}
              };

          this.$form
              // Disable client side validation in HTML 5
              .attr('novalidate', 'novalidate')
              .addClass(this.options.elementClass)
              // Disable the default submission first
              .on('submit.bv', function(e) {
                  e.preventDefault();
                  that.validate();
              })
              .on('click.bv', this.options.submitButtons, function() {
                  that.$submitButton  = $(this);
        // The user just click the submit button
        that._submitIfValid = true;
              })
              // Find all fields which have either "name" or "data-bv-field" attribute
              .find('[name], [data-bv-field]')
                  .each(function() {
                      var $field = $(this),
                          field  = $field.attr('name') || $field.attr('data-bv-field'),
                          opts   = that._parseOptions($field);
                      if (opts) {
                          $field.attr('data-bv-field', field);
                          options.fields[field] = $.extend({}, opts, options.fields[field]);
                      }
                  });

          this.options = $.extend(true, this.options, options);

          // When pressing Enter on any field in the form, the first submit button will do its job.
          // The form then will be submitted.
          // I create a first hidden submit button
          this.$hiddenButton = $('<button/>')
                                  .attr('type', 'submit')
                                  .prependTo(this.$form)
                                  .addClass('bv-hidden-submit')
                                  .css({ display: 'none', width: 0, height: 0 });

          this.$form
              .on('click.bv', '[type="submit"]', function(e) {
                  // #746: Check if the button click handler returns false
                  if (!e.isDefaultPrevented()) {
                      var $target = $(e.target),
                          // The button might contain HTML tag
                          $button = $target.is('[type="submit"]') ? $target.eq(0) : $target.parent('[type="submit"]').eq(0);

                      // Don't perform validation when clicking on the submit button/input
                      // which aren't defined by the 'submitButtons' option
                      if (that.options.submitButtons && !$button.is(that.options.submitButtons) && !$button.is(that.$hiddenButton)) {
                          that.$form.off('submit.bv').submit();
                      }
                  }
              });

          for (var field in this.options.fields) {
              this._initField(field);
          }

          this.$form.trigger($.Event(this.options.events.formInit), {
              bv: this,
              options: this.options
          });

          // Prepare the events
          if (this.options.onSuccess) {
              this.$form.on(this.options.events.formSuccess, function(e) {
                  $.fn.bootstrapValidator.helpers.call(that.options.onSuccess, [e]);
              });
          }
          if (this.options.onError) {
              this.$form.on(this.options.events.formError, function(e) {
                  $.fn.bootstrapValidator.helpers.call(that.options.onError, [e]);
              });
          }
      },

      /**
       * Parse the validator options from HTML attributes
       *
       * @param {jQuery} $field The field element
       * @returns {Object}
       */
      _parseOptions: function($field) {
          var field      = $field.attr('name') || $field.attr('data-bv-field'),
              validators = {},
              validator,
              v,          // Validator name
              attrName,
              enabled,
              optionName,
              optionAttrName,
              optionValue,
              html5AttrName,
              html5AttrMap;

          for (v in $.fn.bootstrapValidator.validators) {
              validator    = $.fn.bootstrapValidator.validators[v];
              attrName     = 'data-bv-' + v.toLowerCase(),
              enabled      = $field.attr(attrName) + '';
              html5AttrMap = ('function' === typeof validator.enableByHtml5) ? validator.enableByHtml5($field) : null;

              if ((html5AttrMap && enabled !== 'false')
                  || (html5AttrMap !== true && ('' === enabled || 'true' === enabled || attrName === enabled.toLowerCase())))
              {
                  // Try to parse the options via attributes
                  validator.html5Attributes = $.extend({}, { message: 'message', onerror: 'onError', onsuccess: 'onSuccess' }, validator.html5Attributes);
                  validators[v] = $.extend({}, html5AttrMap === true ? {} : html5AttrMap, validators[v]);

                  for (html5AttrName in validator.html5Attributes) {
                      optionName  = validator.html5Attributes[html5AttrName];
                      optionAttrName = 'data-bv-' + v.toLowerCase() + '-' + html5AttrName,
                      optionValue = $field.attr(optionAttrName);
                      if (optionValue) {
                          if ('true' === optionValue || optionAttrName === optionValue.toLowerCase()) {
                              optionValue = true;
                          } else if ('false' === optionValue) {
                              optionValue = false;
                          }
                          validators[v][optionName] = optionValue;
                      }
                  }
              }
          }

          var opts = {
                  autoFocus:     $field.attr('data-bv-autofocus'),
                  container:     $field.attr('data-bv-container'),
                  excluded:      $field.attr('data-bv-excluded'),
                  feedbackIcons: $field.attr('data-bv-feedbackicons'),
                  group:         $field.attr('data-bv-group'),
                  message:       $field.attr('data-bv-message'),
                  onError:       $field.attr('data-bv-onerror'),
                  onStatus:      $field.attr('data-bv-onstatus'),
                  onSuccess:     $field.attr('data-bv-onsuccess'),
                  selector:      $field.attr('data-bv-selector'),
                  threshold:     $field.attr('data-bv-threshold'),
                  trigger:       $field.attr('data-bv-trigger'),
                  verbose:       $field.attr('data-bv-verbose'),
                  validators:    validators
              },
              emptyOptions    = $.isEmptyObject(opts),        // Check if the field options are set using HTML attributes
              emptyValidators = $.isEmptyObject(validators);  // Check if the field validators are set using HTML attributes

          if (!emptyValidators || (!emptyOptions && this.options.fields && this.options.fields[field])) {
              opts.validators = validators;
              return opts;
          } else {
              return null;
          }
      },

      /**
       * Init field
       *
       * @param {String|jQuery} field The field name or field element
       */
      _initField: function(field) {
          var fields = $([]);
          switch (typeof field) {
              case 'object':
                  fields = field;
                  field  = field.attr('data-bv-field');
                  break;
              case 'string':
                  fields = this.getFieldElements(field);
                  fields.attr('data-bv-field', field);
                  break;
              default:
                  break;
          }

          // We don't need to validate non-existing fields
          if (fields.length === 0) {
              return;
          }

          if (this.options.fields[field] === null || this.options.fields[field].validators === null) {
              return;
          }

          var validatorName;
          for (validatorName in this.options.fields[field].validators) {
              if (!$.fn.bootstrapValidator.validators[validatorName]) {
                  delete this.options.fields[field].validators[validatorName];
              }
          }
          if (this.options.fields[field].enabled === null) {
              this.options.fields[field].enabled = true;
          }

          var that      = this,
              total     = fields.length,
              type      = fields.attr('type'),
              updateAll = (total === 1) || ('radio' === type) || ('checkbox' === type),
              event     = ('radio' === type || 'checkbox' === type || 'file' === type || 'SELECT' === fields.eq(0).get(0).tagName) ? 'change' : this._changeEvent,
              trigger   = (this.options.fields[field].trigger || this.options.trigger || event).split(' '),
              events    = $.map(trigger, function(item) {
                  return item + '.update.bv';
              }).join(' ');

          for (var i = 0; i < total; i++) {
              var $field    = fields.eq(i),
                  group     = this.options.fields[field].group || this.options.group,
                  $parent   = $field.parents(group),
                  // Allow user to indicate where the error messages are shown
                  container = ('function' === typeof (this.options.fields[field].container || this.options.container)) ? (this.options.fields[field].container || this.options.container).call(this, $field, this) : (this.options.fields[field].container || this.options.container),
                  $message  = (container && container !== 'tooltip' && container !== 'popover') ? $(container) : this._getMessageContainer($field, group);

              if (container && container !== 'tooltip' && container !== 'popover') {
                  $message.addClass('has-error');
              }

              // Remove all error messages and feedback icons
              $message.find('.help-block[data-bv-validator][data-bv-for="' + field + '"]').remove();
              $parent.find('i[data-bv-icon-for="' + field + '"]').remove();

              // Whenever the user change the field value, mark it as not validated yet
              $field.off(events).on(events, function() {
                  that.updateStatus($(this), that.STATUS_NOT_VALIDATED);
              });
              
              // Create help block elements for showing the error messages
              $field.data('bv.messages', $message);
              for (validatorName in this.options.fields[field].validators) {
                  $field.data('bv.result.' + validatorName, this.STATUS_NOT_VALIDATED);

                  if (!updateAll || i === total - 1) {
                      $('<small/>')
                          .css('display', 'none')
                          .addClass('help-block')
                          .attr('data-bv-validator', validatorName)
                          .attr('data-bv-for', field)
                          .attr('data-bv-result', this.STATUS_NOT_VALIDATED)
                          .html(this._getMessage(field, validatorName))
                          .appendTo($message);
                  }

                  // Init the validator
                  if ('function' === typeof $.fn.bootstrapValidator.validators[validatorName].init) {
                      $.fn.bootstrapValidator.validators[validatorName].init(this, $field, this.options.fields[field].validators[validatorName]);
                  }
              }

              // Prepare the feedback icons
              // Available from Bootstrap 3.1 (http://getbootstrap.com/css/#forms-control-validation)
              if (this.options.fields[field].feedbackIcons !== false && this.options.fields[field].feedbackIcons !== 'false'
                  && this.options.feedbackIcons
                  && this.options.feedbackIcons.validating && this.options.feedbackIcons.invalid && this.options.feedbackIcons.valid
                  && (!updateAll || i === total - 1))
              {
                  // $parent.removeClass('has-success').removeClass('has-error').addClass('has-feedback');
                  // Keep error messages which are populated from back-end
                  $parent.addClass('has-feedback');
                  var $icon = $('<i/>')
                                  .css('display', 'none')
                                  .addClass('form-control-feedback')
                                  .attr('data-bv-icon-for', field)
                                  .insertAfter($field);

                  // Place it after the container of checkbox/radio
                  // so when clicking the icon, it doesn't effect to the checkbox/radio element
                  if ('checkbox' === type || 'radio' === type) {
                      var $fieldParent = $field.parent();
                      if ($fieldParent.hasClass(type)) {
                          $icon.insertAfter($fieldParent);
                      } else if ($fieldParent.parent().hasClass(type)) {
                          $icon.insertAfter($fieldParent.parent());
                      }
                  }

                  // The feedback icon does not render correctly if there is no label
                  // https://github.com/twbs/bootstrap/issues/12873
                  if ($parent.find('label').length === 0) {
                      $icon.addClass('bv-no-label');
                  }
                  // Fix feedback icons in input-group
                  if ($parent.find('.input-group').length !== 0) {
                      $icon.addClass('bv-icon-input-group')
                           .insertAfter($parent.find('.input-group').eq(0));
                  }

                  // Store the icon as a data of field element
                  if (!updateAll) {
                      $field.data('bv.icon', $icon);
                  } else if (i === total - 1) {
                      // All fields with the same name have the same icon
                      fields.data('bv.icon', $icon);
                  }
                  
                  if (container) {
                      $field
                          // Show tooltip/popover message when field gets focus
                          .off('focus.container.bv')
                          .on('focus.container.bv', function() {
                              switch (container) {
                                  case 'tooltip':
                                      $(this).data('bv.icon').tooltip('show');
                                      break;
                                  case 'popover':
                                      $(this).data('bv.icon').popover('show');
                                      break;
                                  default:
                                      break;
                              }
                          })
                          // and hide them when losing focus
                          .off('blur.container.bv')
                          .on('blur.container.bv', function() {
                              switch (container) {
                                  case 'tooltip':
                                      $(this).data('bv.icon').tooltip('hide');
                                      break;
                                  case 'popover':
                                      $(this).data('bv.icon').popover('hide');
                                      break;
                                  default:
                                      break;
                              }
                          });
                  }
              }
          }

          // Prepare the events
          fields
              .on(this.options.events.fieldSuccess, function(e, data) {
                  var onSuccess = that.getOptions(data.field, null, 'onSuccess');
                  if (onSuccess) {
                      $.fn.bootstrapValidator.helpers.call(onSuccess, [e, data]);
                  }
              })
              .on(this.options.events.fieldError, function(e, data) {
                  var onError = that.getOptions(data.field, null, 'onError');
                  if (onError) {
                      $.fn.bootstrapValidator.helpers.call(onError, [e, data]);
                  }
              })
              .on(this.options.events.fieldStatus, function(e, data) {
                  var onStatus = that.getOptions(data.field, null, 'onStatus');
                  if (onStatus) {
                      $.fn.bootstrapValidator.helpers.call(onStatus, [e, data]);
                  }
              })
              .on(this.options.events.validatorError, function(e, data) {
                  var onError = that.getOptions(data.field, data.validator, 'onError');
                  if (onError) {
                      $.fn.bootstrapValidator.helpers.call(onError, [e, data]);
                  }
              })
              .on(this.options.events.validatorSuccess, function(e, data) {
                  var onSuccess = that.getOptions(data.field, data.validator, 'onSuccess');
                  if (onSuccess) {
                      $.fn.bootstrapValidator.helpers.call(onSuccess, [e, data]);
                  }
              });

          // Set live mode
          events = $.map(trigger, function(item) {
              return item + '.live.bv';
          }).join(' ');
          switch (this.options.live) {
              case 'submitted':
                  break;
              case 'disabled':
                  fields.off(events);
                  break;
              case 'enabled':
              /* falls through */
              default:
                  fields.off(events).on(events, function() {
                      if (that._exceedThreshold($(this))) {
                          that.validateField($(this));
                      }
                  });
                  break;
          }

          fields.trigger($.Event(this.options.events.fieldInit), {
              bv: this,
              field: field,
              element: fields
          });
      },

      /**
       * Get the error message for given field and validator
       *
       * @param {String} field The field name
       * @param {String} validatorName The validator name
       * @returns {String}
       */
      _getMessage: function(field, validatorName) {
          if (!this.options.fields[field] || !$.fn.bootstrapValidator.validators[validatorName]
              || !this.options.fields[field].validators || !this.options.fields[field].validators[validatorName])
          {
              return '';
          }

          var options = this.options.fields[field].validators[validatorName];
          switch (true) {
              case (!!options.message):
                  return options.message;
              case (!!this.options.fields[field].message):
                  return this.options.fields[field].message;
              case (!!$.fn.bootstrapValidator.i18n[validatorName]):
                  return $.fn.bootstrapValidator.i18n[validatorName]['default'];
              default:
                  return this.options.message;
          }
      },

      /**
       * Get the element to place the error messages
       *
       * @param {jQuery} $field The field element
       * @param {String} group
       * @returns {jQuery}
       */
      _getMessageContainer: function($field, group) {
          var $parent = $field.parent();
          if ($parent.is(group)) {
              return $parent;
          }

          var cssClasses = $parent.attr('class');
          if (!cssClasses) {
              return this._getMessageContainer($parent, group);
          }

          cssClasses = cssClasses.split(' ');
          var n = cssClasses.length;
          for (var i = 0; i < n; i++) {
              if (/^col-(xs|sm|md|lg)-\d+$/.test(cssClasses[i]) || /^col-(xs|sm|md|lg)-offset-\d+$/.test(cssClasses[i])) {
                  return $parent;
              }
          }

          return this._getMessageContainer($parent, group);
      },

      /**
       * Called when all validations are completed
       */
      _submit: function() {
          var isValid   = this.isValid(),
              eventType = isValid ? this.options.events.formSuccess : this.options.events.formError,
              e         = $.Event(eventType);

          this.$form.trigger(e);

          // Call default handler
          // Check if whether the submit button is clicked
          if (this.$submitButton) {
              isValid ? this._onSuccess(e) : this._onError(e);
          }
      },

      /**
       * Check if the field is excluded.
       * Returning true means that the field will not be validated
       *
       * @param {jQuery} $field The field element
       * @returns {Boolean}
       */
      _isExcluded: function($field) {
          var excludedAttr = $field.attr('data-bv-excluded'),
              // I still need to check the 'name' attribute while initializing the field
              field        = $field.attr('data-bv-field') || $field.attr('name');

          switch (true) {
              case (!!field && this.options.fields && this.options.fields[field] && (this.options.fields[field].excluded === 'true' || this.options.fields[field].excluded === true)):
              case (excludedAttr === 'true'):
              case (excludedAttr === ''):
                  return true;

              case (!!field && this.options.fields && this.options.fields[field] && (this.options.fields[field].excluded === 'false' || this.options.fields[field].excluded === false)):
              case (excludedAttr === 'false'):
                  return false;

              default:
                  if (this.options.excluded) {
                      // Convert to array first
                      if ('string' === typeof this.options.excluded) {
                          this.options.excluded = $.map(this.options.excluded.split(','), function(item) {
                              // Trim the spaces
                              return $.trim(item);
                          });
                      }

                      var length = this.options.excluded.length;
                      for (var i = 0; i < length; i++) {
                          if (('string' === typeof this.options.excluded[i] && $field.is(this.options.excluded[i]))
                              || ('function' === typeof this.options.excluded[i] && this.options.excluded[i].call(this, $field, this) === true))
                          {
                              return true;
                          }
                      }
                  }
                  return false;
          }
      },

      /**
       * Check if the number of characters of field value exceed the threshold or not
       *
       * @param {jQuery} $field The field element
       * @returns {Boolean}
       */
      _exceedThreshold: function($field) {
          var field     = $field.attr('data-bv-field'),
              threshold = this.options.fields[field].threshold || this.options.threshold;
          if (!threshold) {
              return true;
          }
          var cannotType = $.inArray($field.attr('type'), ['button', 'checkbox', 'file', 'hidden', 'image', 'radio', 'reset', 'submit']) !== -1;
          return (cannotType || $field.val().length >= threshold);
      },
      
      // ---
      // Events
      // ---

      /**
       * The default handler of error.form.bv event.
       * It will be called when there is a invalid field
       *
       * @param {jQuery.Event} e The jQuery event object
       */
      _onError: function(e) {
          if (e.isDefaultPrevented()) {
              return;
          }

          if ('submitted' === this.options.live) {
              // Enable live mode
              this.options.live = 'enabled';
              var that = this;
              for (var field in this.options.fields) {
                  (function(f) {
                      var fields  = that.getFieldElements(f);
                      if (fields.length) {
                          var type    = $(fields[0]).attr('type'),
                              event   = ('radio' === type || 'checkbox' === type || 'file' === type || 'SELECT' === $(fields[0]).get(0).tagName) ? 'change' : that._changeEvent,
                              trigger = that.options.fields[field].trigger || that.options.trigger || event,
                              events  = $.map(trigger.split(' '), function(item) {
                                  return item + '.live.bv';
                              }).join(' ');

                          fields.off(events).on(events, function() {
                              if (that._exceedThreshold($(this))) {
                                  that.validateField($(this));
                              }
                          });
                      }
                  })(field);
              }
          }

          // Determined the first invalid field which will be focused on automatically
          for (var i = 0; i < this.$invalidFields.length; i++) {
              var $field    = this.$invalidFields.eq(i),
                  autoFocus = this._isOptionEnabled($field.attr('data-bv-field'), 'autoFocus');
              if (autoFocus) {
                  // Activate the tab containing the field if exists
                  var $tabPane = $field.parents('.tab-pane'), tabId;
                  if ($tabPane && (tabId = $tabPane.attr('id'))) {
                      $('a[href="#' + tabId + '"][data-toggle="tab"]').tab('show');
                  }

                  // Focus the field
                  $field.focus();
                  break;
              }
          }
      },

      /**
       * The default handler of success.form.bv event.
       * It will be called when all the fields are valid
       *
       * @param {jQuery.Event} e The jQuery event object
       */
      _onSuccess: function(e) {
          if (e.isDefaultPrevented()) {
              return;
          }

          // Submit the form
          this.disableSubmitButtons(true).defaultSubmit();
      },

      /**
       * Called after validating a field element
       *
       * @param {jQuery} $field The field element
       * @param {String} [validatorName] The validator name
       */
      _onFieldValidated: function($field, validatorName) {
          var field         = $field.attr('data-bv-field'),
              validators    = this.options.fields[field].validators,
              counter       = {},
              numValidators = 0,
              data          = {
                  bv: this,
                  field: field,
                  element: $field,
                  validator: validatorName,
                  result: $field.data('bv.response.' + validatorName)
              };

          // Trigger an event after given validator completes
          if (validatorName) {
              switch ($field.data('bv.result.' + validatorName)) {
                  case this.STATUS_INVALID:
                      $field.trigger($.Event(this.options.events.validatorError), data);
                      break;
                  case this.STATUS_VALID:
                      $field.trigger($.Event(this.options.events.validatorSuccess), data);
                      break;
                  default:
                      break;
              }
          }

          counter[this.STATUS_NOT_VALIDATED] = 0;
          counter[this.STATUS_VALIDATING]    = 0;
          counter[this.STATUS_INVALID]       = 0;
          counter[this.STATUS_VALID]         = 0;

          for (var v in validators) {
              if (validators[v].enabled === false) {
                  continue;
              }

              numValidators++;
              var result = $field.data('bv.result.' + v);
              if (result) {
                  counter[result]++;
              }
          }

          if (counter[this.STATUS_VALID] === numValidators) {
              // Remove from the list of invalid fields
              this.$invalidFields = this.$invalidFields.not($field);

              $field.trigger($.Event(this.options.events.fieldSuccess), data);
          }
          // If all validators are completed and there is at least one validator which doesn't pass
          else if ((counter[this.STATUS_NOT_VALIDATED] === 0 || !this._isOptionEnabled(field, 'verbose')) && counter[this.STATUS_VALIDATING] === 0 && counter[this.STATUS_INVALID] > 0) {
              // Add to the list of invalid fields
              this.$invalidFields = this.$invalidFields.add($field);

              $field.trigger($.Event(this.options.events.fieldError), data);
          }
      },

      /**
       * Check whether or not a field option is enabled
       *
       * @param {String} field The field name
       * @param {String} option The option name, "verbose", "autoFocus", for example
       * @returns {Boolean}
       */
      _isOptionEnabled: function(field, option) {
          if (this.options.fields[field] && (this.options.fields[field][option] === 'true' || this.options.fields[field][option] === true)) {
              return true;
          }
          if (this.options.fields[field] && (this.options.fields[field][option] === 'false' || this.options.fields[field][option] === false)) {
              return false;
          }
          return this.options[option] === 'true' || this.options[option] === true;
      },

      // ---
      // Public methods
      // ---

      /**
       * Retrieve the field elements by given name
       *
       * @param {String} field The field name
       * @returns {null|jQuery[]}
       */
      getFieldElements: function(field) {
          if (!this._cacheFields[field]) {
              this._cacheFields[field] = (this.options.fields[field] && this.options.fields[field].selector)
                                       ? $(this.options.fields[field].selector)
                                       : this.$form.find('[name="' + field + '"]');
          }

          return this._cacheFields[field];
      },

      /**
       * Get the field options
       *
       * @param {String|jQuery} [field] The field name or field element. If it is not set, the method returns the form options
       * @param {String} [validator] The name of validator. It null, the method returns form options
       * @param {String} [option] The option name
       * @return {String|Object}
       */
      getOptions: function(field, validator, option) {
          if (!field) {
              return option ? this.options[option] : this.options;
          }
          if ('object' === typeof field) {
              field = field.attr('data-bv-field');
          }
          if (!this.options.fields[field]) {
              return null;
          }

          var options = this.options.fields[field];
          if (!validator) {
              return option ? options[option] : options;
          }
          if (!options.validators || !options.validators[validator]) {
              return null;
          }

          return option ? options.validators[validator][option] : options.validators[validator];
      },

      /**
       * Disable/enable submit buttons
       *
       * @param {Boolean} disabled Can be true or false
       * @returns {BootstrapValidator}
       */
      disableSubmitButtons: function(disabled) {
          if (!disabled) {
              this.$form.find(this.options.submitButtons).removeAttr('disabled');
          } else if (this.options.live !== 'disabled') {
              // Don't disable if the live validating mode is disabled
              this.$form.find(this.options.submitButtons).attr('disabled', 'disabled');
          }

          return this;
      },

      /**
       * Validate the form
       *
       * @returns {BootstrapValidator}
       */
      validate: function() {
          if (!this.options.fields) {
              return this;
          }
          this.disableSubmitButtons(true);

          this._submitIfValid = false;
          for (var field in this.options.fields) {
              this.validateField(field);
          }

          this._submit();
          this._submitIfValid = true;

          return this;
      },

      /**
       * Validate given field
       *
       * @param {String|jQuery} field The field name or field element
       * @returns {BootstrapValidator}
       */
      validateField: function(field) {
          var fields = $([]);
          switch (typeof field) {
              case 'object':
                  fields = field;
                  field  = field.attr('data-bv-field');
                  break;
              case 'string':
                  fields = this.getFieldElements(field);
                  break;
              default:
                  break;
          }

          if (fields.length === 0 || !this.options.fields[field] || this.options.fields[field].enabled === false) {
              return this;
          }

          var that       = this,
              type       = fields.attr('type'),
              total      = ('radio' === type || 'checkbox' === type) ? 1 : fields.length,
              updateAll  = ('radio' === type || 'checkbox' === type),
              validators = this.options.fields[field].validators,
              verbose    = this._isOptionEnabled(field, 'verbose'),
              validatorName,
              validateResult;

          for (var i = 0; i < total; i++) {
              var $field = fields.eq(i);
              if (this._isExcluded($field)) {
                  continue;
              }

              var stop = false;
              for (validatorName in validators) {
                  if ($field.data('bv.dfs.' + validatorName)) {
                      $field.data('bv.dfs.' + validatorName).reject();
                  }
                  if (stop) {
                      break;
                  }

                  // Don't validate field if it is already done
                  var result = $field.data('bv.result.' + validatorName);
                  if (result === this.STATUS_VALID || result === this.STATUS_INVALID) {
                      this._onFieldValidated($field, validatorName);
                      continue;
                  } else if (validators[validatorName].enabled === false) {
                      this.updateStatus(updateAll ? field : $field, this.STATUS_VALID, validatorName);
                      continue;
                  }

                  $field.data('bv.result.' + validatorName, this.STATUS_VALIDATING);
                  validateResult = $.fn.bootstrapValidator.validators[validatorName].validate(this, $field, validators[validatorName]);

                  // validateResult can be a $.Deferred object ...
                  if ('object' === typeof validateResult && validateResult.resolve) {
                      this.updateStatus(updateAll ? field : $field, this.STATUS_VALIDATING, validatorName);
                      $field.data('bv.dfs.' + validatorName, validateResult);

                      validateResult.done(function($f, v, response) {
                          // v is validator name
                          $f.removeData('bv.dfs.' + v).data('bv.response.' + v, response);
                          if (response.message) {
                              that.updateMessage($f, v, response.message);
                          }

                          that.updateStatus(updateAll ? $f.attr('data-bv-field') : $f, response.valid ? that.STATUS_VALID : that.STATUS_INVALID, v);

                          if (response.valid && that._submitIfValid === true) {
                              // If a remote validator returns true and the form is ready to submit, then do it
                              that._submit();
                          } else if (!response.valid && !verbose) {
                              stop = true;
                          }
                      });
                  }
                  // ... or object { valid: true/false, message: 'dynamic message' }
                  else if ('object' === typeof validateResult && validateResult.valid !== undefined && validateResult.message !== undefined) {
                      $field.data('bv.response.' + validatorName, validateResult);
                      this.updateMessage(updateAll ? field : $field, validatorName, validateResult.message);
                      this.updateStatus(updateAll ? field : $field, validateResult.valid ? this.STATUS_VALID : this.STATUS_INVALID, validatorName);
                      if (!validateResult.valid && !verbose) {
                          break;
                      }
                  }
                  // ... or a boolean value
                  else if ('boolean' === typeof validateResult) {
                      $field.data('bv.response.' + validatorName, validateResult);
                      this.updateStatus(updateAll ? field : $field, validateResult ? this.STATUS_VALID : this.STATUS_INVALID, validatorName);
                      if (!validateResult && !verbose) {
                          break;
                      }
                  }
              }
          }

          return this;
      },

      /**
       * Update the error message
       *
       * @param {String|jQuery} field The field name or field element
       * @param {String} validator The validator name
       * @param {String} message The message
       * @returns {BootstrapValidator}
       */
      updateMessage: function(field, validator, message) {
          var $fields = $([]);
          switch (typeof field) {
              case 'object':
                  $fields = field;
                  field   = field.attr('data-bv-field');
                  break;
              case 'string':
                  $fields = this.getFieldElements(field);
                  break;
              default:
                  break;
          }

          $fields.each(function() {
              $(this).data('bv.messages').find('.help-block[data-bv-validator="' + validator + '"][data-bv-for="' + field + '"]').html(message);
          });
      },
      
      /**
       * Update all validating results of field
       *
       * @param {String|jQuery} field The field name or field element
       * @param {String} status The status. Can be 'NOT_VALIDATED', 'VALIDATING', 'INVALID' or 'VALID'
       * @param {String} [validatorName] The validator name. If null, the method updates validity result for all validators
       * @returns {BootstrapValidator}
       */
      updateStatus: function(field, status, validatorName) {
          var fields = $([]);
          switch (typeof field) {
              case 'object':
                  fields = field;
                  field  = field.attr('data-bv-field');
                  break;
              case 'string':
                  fields = this.getFieldElements(field);
                  break;
              default:
                  break;
          }

          if (status === this.STATUS_NOT_VALIDATED) {
              // Reset the flag
              // To prevent the form from doing submit when a deferred validator returns true while typing
              this._submitIfValid = false;
          }

          var that  = this,
              type  = fields.attr('type'),
              group = this.options.fields[field].group || this.options.group,
              total = ('radio' === type || 'checkbox' === type) ? 1 : fields.length;

          for (var i = 0; i < total; i++) {
              var $field       = fields.eq(i);
              if (this._isExcluded($field)) {
                  continue;
              }

              var $parent      = $field.parents(group),
                  $message     = $field.data('bv.messages'),
                  $allErrors   = $message.find('.help-block[data-bv-validator][data-bv-for="' + field + '"]'),
                  $errors      = validatorName ? $allErrors.filter('[data-bv-validator="' + validatorName + '"]') : $allErrors,
                  $icon        = $field.data('bv.icon'),
                  container    = ('function' === typeof (this.options.fields[field].container || this.options.container)) ? (this.options.fields[field].container || this.options.container).call(this, $field, this) : (this.options.fields[field].container || this.options.container),
                  isValidField = null;

              // Update status
              if (validatorName) {
                  $field.data('bv.result.' + validatorName, status);
              } else {
                  for (var v in this.options.fields[field].validators) {
                      $field.data('bv.result.' + v, status);
                  }
              }

              // Show/hide error elements and feedback icons
              $errors.attr('data-bv-result', status);

              // Determine the tab containing the element
              var $tabPane = $field.parents('.tab-pane'),
                  tabId, $tab;
              if ($tabPane && (tabId = $tabPane.attr('id'))) {
                  $tab = $('a[href="#' + tabId + '"][data-toggle="tab"]').parent();
              }

              switch (status) {
                  case this.STATUS_VALIDATING:
                      isValidField = null;
                      this.disableSubmitButtons(true);
                      $parent.removeClass('has-success').removeClass('has-error');
                      if ($icon) {
                          $icon.removeClass(this.options.feedbackIcons.valid).removeClass(this.options.feedbackIcons.invalid).addClass(this.options.feedbackIcons.validating).show();
                      }
                      if ($tab) {
                          $tab.removeClass('bv-tab-success').removeClass('bv-tab-error');
                      }
                      break;

                  case this.STATUS_INVALID:
                      isValidField = false;
                      this.disableSubmitButtons(true);
                      $parent.removeClass('has-success').addClass('has-error');
                      if ($icon) {
                          $icon.removeClass(this.options.feedbackIcons.valid).removeClass(this.options.feedbackIcons.validating).addClass(this.options.feedbackIcons.invalid).show();
                      }
                      if ($tab) {
                          $tab.removeClass('bv-tab-success').addClass('bv-tab-error');
                      }
                      break;

                  case this.STATUS_VALID:
                      // If the field is valid (passes all validators)
                      isValidField = ($allErrors.filter('[data-bv-result="' + this.STATUS_NOT_VALIDATED +'"]').length === 0)
                                   ? ($allErrors.filter('[data-bv-result="' + this.STATUS_VALID +'"]').length === $allErrors.length)  // All validators are completed
                                   : null;                                                                                            // There are some validators that have not done
                      if (isValidField !== null) {
                          this.disableSubmitButtons(this.$submitButton ? !this.isValid() : !isValidField);
                          if ($icon) {
                              $icon
                                  .removeClass(this.options.feedbackIcons.invalid).removeClass(this.options.feedbackIcons.validating).removeClass(this.options.feedbackIcons.valid)
                                  .addClass(isValidField ? this.options.feedbackIcons.valid : this.options.feedbackIcons.invalid)
                                  .show();
                          }
                      }

                      $parent.removeClass('has-error has-success').addClass(this.isValidContainer($parent) ? 'has-success' : 'has-error');
                      if ($tab) {
                          $tab.removeClass('bv-tab-success').removeClass('bv-tab-error').addClass(this.isValidContainer($tabPane) ? 'bv-tab-success' : 'bv-tab-error');
                      }
                      break;

                  case this.STATUS_NOT_VALIDATED:
                  /* falls through */
                  default:
                      isValidField = null;
                      this.disableSubmitButtons(false);
                      $parent.removeClass('has-success').removeClass('has-error');
                      if ($icon) {
                          $icon.removeClass(this.options.feedbackIcons.valid).removeClass(this.options.feedbackIcons.invalid).removeClass(this.options.feedbackIcons.validating).hide();
                      }
                      if ($tab) {
                          $tab.removeClass('bv-tab-success').removeClass('bv-tab-error');
                      }
                      break;
              }

              switch (true) {
                  // Only show the first error message if it is placed inside a tooltip ...
                  case ($icon && 'tooltip' === container):
                      (isValidField === false)
                              ? $icon.css('cursor', 'pointer').tooltip('destroy').tooltip({
                                  container: 'body',
                                  html: true,
                                  placement: 'auto top',
                                  title: $allErrors.filter('[data-bv-result="' + that.STATUS_INVALID + '"]').eq(0).html()
                              })
                              : $icon.css('cursor', '').tooltip('destroy');
                      break;
                  // ... or popover
                  case ($icon && 'popover' === container):
                      (isValidField === false)
                              ? $icon.css('cursor', 'pointer').popover('destroy').popover({
                                  container: 'body',
                                  content: $allErrors.filter('[data-bv-result="' + that.STATUS_INVALID + '"]').eq(0).html(),
                                  html: true,
                                  placement: 'auto top',
                                  trigger: 'hover click'
                              })
                              : $icon.css('cursor', '').popover('destroy');
                      break;
                  default:
                      (status === this.STATUS_INVALID) ? $errors.show() : $errors.hide();
                      break;
              }

              // Trigger an event
              $field.trigger($.Event(this.options.events.fieldStatus), {
                  bv: this,
                  field: field,
                  element: $field,
                  status: status
              });
              this._onFieldValidated($field, validatorName);
          }

          return this;
      },

      /**
       * Check the form validity
       *
       * @returns {Boolean}
       */
      isValid: function() {
          for (var field in this.options.fields) {
              if (!this.isValidField(field)) {
                  return false;
              }
          }

          return true;
      },

      /**
       * Check if the field is valid or not
       *
       * @param {String|jQuery} field The field name or field element
       * @returns {Boolean}
       */
      isValidField: function(field) {
          var fields = $([]);
          switch (typeof field) {
              case 'object':
                  fields = field;
                  field  = field.attr('data-bv-field');
                  break;
              case 'string':
                  fields = this.getFieldElements(field);
                  break;
              default:
                  break;
          }
          if (fields.length === 0 || !this.options.fields[field] || this.options.fields[field].enabled === false) {
              return true;
          }

          var type  = fields.attr('type'),
              total = ('radio' === type || 'checkbox' === type) ? 1 : fields.length,
              $field, validatorName, status;
          for (var i = 0; i < total; i++) {
              $field = fields.eq(i);
              if (this._isExcluded($field)) {
                  continue;
              }

              for (validatorName in this.options.fields[field].validators) {
                  if (this.options.fields[field].validators[validatorName].enabled === false) {
                      continue;
                  }

                  status = $field.data('bv.result.' + validatorName);
                  if (status !== this.STATUS_VALID) {
                      return false;
                  }
              }
          }

          return true;
      },

      /**
       * Check if all fields inside a given container are valid.
       * It's useful when working with a wizard-like such as tab, collapse
       *
       * @param {String|jQuery} container The container selector or element
       * @returns {Boolean}
       */
      isValidContainer: function(container) {
          var that       = this,
              map        = {},
              $container = ('string' === typeof container) ? $(container) : container;
          if ($container.length === 0) {
              return true;
          }

          $container.find('[data-bv-field]').each(function() {
              var $field = $(this),
                  field  = $field.attr('data-bv-field');
              if (!that._isExcluded($field) && !map[field]) {
                  map[field] = $field;
              }
          });

          for (var field in map) {
              var $f = map[field];
              if ($f.data('bv.messages')
                    .find('.help-block[data-bv-validator][data-bv-for="' + field + '"]')
                    .filter('[data-bv-result="' + this.STATUS_INVALID +'"]')
                    .length > 0)
              {
                  return false;
              }
          }

          return true;
      },

      /**
       * Submit the form using default submission.
       * It also does not perform any validations when submitting the form
       */
      defaultSubmit: function() {
          if (this.$submitButton) {
              // Create hidden input to send the submit buttons
              $('<input/>')
                  .attr('type', 'hidden')
                  .attr('data-bv-submit-hidden', '')
                  .attr('name', this.$submitButton.attr('name'))
                  .val(this.$submitButton.val())
                  .appendTo(this.$form);
          }

          // Submit form
          this.$form.off('submit.bv').submit();
      },

      // ---
      // Useful APIs which aren't used internally
      // ---

      /**
       * Get the list of invalid fields
       *
       * @returns {jQuery[]}
       */
      getInvalidFields: function() {
          return this.$invalidFields;
      },

      /**
       * Returns the clicked submit button
       *
       * @returns {jQuery}
       */
      getSubmitButton: function() {
          return this.$submitButton;
      },

      /**
       * Get the error messages
       *
       * @param {String|jQuery} [field] The field name or field element
       * If the field is not defined, the method returns all error messages of all fields
       * @param {String} [validator] The name of validator
       * If the validator is not defined, the method returns error messages of all validators
       * @returns {String[]}
       */
      getMessages: function(field, validator) {
          var that     = this,
              messages = [],
              $fields  = $([]);

          switch (true) {
              case (field && 'object' === typeof field):
                  $fields = field;
                  break;
              case (field && 'string' === typeof field):
                  var f = this.getFieldElements(field);
                  if (f.length > 0) {
                      var type = f.attr('type');
                      $fields = ('radio' === type || 'checkbox' === type) ? f.eq(0) : f;
                  }
                  break;
              default:
                  $fields = this.$invalidFields;
                  break;
          }

          var filter = validator ? '[data-bv-validator="' + validator + '"]' : '';
          $fields.each(function() {
              messages = messages.concat(
                  $(this)
                      .data('bv.messages')
                      .find('.help-block[data-bv-for="' + $(this).attr('data-bv-field') + '"][data-bv-result="' + that.STATUS_INVALID + '"]' + filter)
                      .map(function() {
                          var v = $(this).attr('data-bv-validator'),
                              f = $(this).attr('data-bv-for');
                          return (that.options.fields[f].validators[v].enabled === false) ? '' : $(this).html();
                      })
                      .get()
              );
          });

          return messages;
      },

      /**
       * Update the option of a specific validator
       *
       * @param {String|jQuery} field The field name or field element
       * @param {String} validator The validator name
       * @param {String} option The option name
       * @param {String} value The value to set
       * @returns {BootstrapValidator}
       */
      updateOption: function(field, validator, option, value) {
          if ('object' === typeof field) {
              field = field.attr('data-bv-field');
          }
          if (this.options.fields[field] && this.options.fields[field].validators[validator]) {
              this.options.fields[field].validators[validator][option] = value;
              this.updateStatus(field, this.STATUS_NOT_VALIDATED, validator);
          }

          return this;
      },

      /**
       * Add a new field
       *
       * @param {String|jQuery} field The field name or field element
       * @param {Object} [options] The validator rules
       * @returns {BootstrapValidator}
       */
      addField: function(field, options) {
          var fields = $([]);
          switch (typeof field) {
              case 'object':
                  fields = field;
                  field  = field.attr('data-bv-field') || field.attr('name');
                  break;
              case 'string':
                  delete this._cacheFields[field];
                  fields = this.getFieldElements(field);
                  break;
              default:
                  break;
          }

          fields.attr('data-bv-field', field);

          var type  = fields.attr('type'),
              total = ('radio' === type || 'checkbox' === type) ? 1 : fields.length;

          for (var i = 0; i < total; i++) {
              var $field = fields.eq(i);

              // Try to parse the options from HTML attributes
              var opts = this._parseOptions($field);
              opts = (opts === null) ? options : $.extend(true, options, opts);

              this.options.fields[field] = $.extend(true, this.options.fields[field], opts);

              // Update the cache
              this._cacheFields[field] = this._cacheFields[field] ? this._cacheFields[field].add($field) : $field;

              // Init the element
              this._initField(('checkbox' === type || 'radio' === type) ? field : $field);
          }

          this.disableSubmitButtons(false);
          // Trigger an event
          this.$form.trigger($.Event(this.options.events.fieldAdded), {
              field: field,
              element: fields,
              options: this.options.fields[field]
          });

          return this;
      },

      /**
       * Remove a given field
       *
       * @param {String|jQuery} field The field name or field element
       * @returns {BootstrapValidator}
       */
      removeField: function(field) {
          var fields = $([]);
          switch (typeof field) {
              case 'object':
                  fields = field;
                  field  = field.attr('data-bv-field') || field.attr('name');
                  fields.attr('data-bv-field', field);
                  break;
              case 'string':
                  fields = this.getFieldElements(field);
                  break;
              default:
                  break;
          }

          if (fields.length === 0) {
              return this;
          }

          var type  = fields.attr('type'),
              total = ('radio' === type || 'checkbox' === type) ? 1 : fields.length;

          for (var i = 0; i < total; i++) {
              var $field = fields.eq(i);

              // Remove from the list of invalid fields
              this.$invalidFields = this.$invalidFields.not($field);

              // Update the cache
              this._cacheFields[field] = this._cacheFields[field].not($field);
          }

          if (!this._cacheFields[field] || this._cacheFields[field].length === 0) {
              delete this.options.fields[field];
          }
          if ('checkbox' === type || 'radio' === type) {
              this._initField(field);
          }

          this.disableSubmitButtons(false);
          // Trigger an event
          this.$form.trigger($.Event(this.options.events.fieldRemoved), {
              field: field,
              element: fields
          });

          return this;
      },

      /**
       * Reset given field
       *
       * @param {String|jQuery} field The field name or field element
       * @param {Boolean} [resetValue] If true, the method resets field value to empty or remove checked/selected attribute (for radio/checkbox)
       * @returns {BootstrapValidator}
       */
      resetField: function(field, resetValue) {
          var $fields = $([]);
          switch (typeof field) {
              case 'object':
                  $fields = field;
                  field   = field.attr('data-bv-field');
                  break;
              case 'string':
                  $fields = this.getFieldElements(field);
                  break;
              default:
                  break;
          }

          var total = $fields.length;
          if (this.options.fields[field]) {
              for (var i = 0; i < total; i++) {
                  for (var validator in this.options.fields[field].validators) {
                      $fields.eq(i).removeData('bv.dfs.' + validator);
                  }
              }
          }

          // Mark field as not validated yet
          this.updateStatus(field, this.STATUS_NOT_VALIDATED);

          if (resetValue) {
              var type = $fields.attr('type');
              ('radio' === type || 'checkbox' === type) ? $fields.removeAttr('checked').removeAttr('selected') : $fields.val('');
          }

          return this;
      },

      /**
       * Reset the form
       *
       * @param {Boolean} [resetValue] If true, the method resets field value to empty or remove checked/selected attribute (for radio/checkbox)
       * @returns {BootstrapValidator}
       */
      resetForm: function(resetValue) {
          for (var field in this.options.fields) {
              this.resetField(field, resetValue);
          }

          this.$invalidFields = $([]);
          this.$submitButton  = null;

          // Enable submit buttons
          this.disableSubmitButtons(false);

          return this;
      },

      /**
       * Revalidate given field
       * It's used when you need to revalidate the field which its value is updated by other plugin
       *
       * @param {String|jQuery} field The field name of field element
       * @returns {BootstrapValidator}
       */
      revalidateField: function(field) {
          this.updateStatus(field, this.STATUS_NOT_VALIDATED)
              .validateField(field);

          return this;
      },

      /**
       * Enable/Disable all validators to given field
       *
       * @param {String} field The field name
       * @param {Boolean} enabled Enable/Disable field validators
       * @param {String} [validatorName] The validator name. If null, all validators will be enabled/disabled
       * @returns {BootstrapValidator}
       */
      enableFieldValidators: function(field, enabled, validatorName) {
          var validators = this.options.fields[field].validators;

          // Enable/disable particular validator
          if (validatorName
              && validators
              && validators[validatorName] && validators[validatorName].enabled !== enabled)
          {
              this.options.fields[field].validators[validatorName].enabled = enabled;
              this.updateStatus(field, this.STATUS_NOT_VALIDATED, validatorName);
          }
          // Enable/disable all validators
          else if (!validatorName && this.options.fields[field].enabled !== enabled) {
              this.options.fields[field].enabled = enabled;
              for (var v in validators) {
                  this.enableFieldValidators(field, enabled, v);
              }
          }

          return this;
      },

      /**
       * Some validators have option which its value is dynamic.
       * For example, the zipCode validator has the country option which might be changed dynamically by a select element.
       *
       * @param {jQuery|String} field The field name or element
       * @param {String|Function} option The option which can be determined by:
       * - a string
       * - name of field which defines the value
       * - name of function which returns the value
       * - a function returns the value
       *
       * The callback function has the format of
       *      callback: function(value, validator, $field) {
       *          // value is the value of field
       *          // validator is the BootstrapValidator instance
       *          // $field is the field element
       *      }
       *
       * @returns {String}
       */
      getDynamicOption: function(field, option) {
          var $field = ('string' === typeof field) ? this.getFieldElements(field) : field,
              value  = $field.val();

          // Option can be determined by
          // ... a function
          if ('function' === typeof option) {
              return $.fn.bootstrapValidator.helpers.call(option, [value, this, $field]);
          }
          // ... value of other field
          else if ('string' === typeof option) {
              var $f = this.getFieldElements(option);
              if ($f.length) {
                  return $f.val();
              }
              // ... return value of callback
              else {
                  return $.fn.bootstrapValidator.helpers.call(option, [value, this, $field]) || option;
              }
          }

          return null;
      },

      /**
       * Destroy the plugin
       * It will remove all error messages, feedback icons and turn off the events
       */
      destroy: function() {
          var field, fields, $field, validator, $icon, group;
          for (field in this.options.fields) {
              fields    = this.getFieldElements(field);
              group     = this.options.fields[field].group || this.options.group;
              for (var i = 0; i < fields.length; i++) {
                  $field = fields.eq(i);
                  $field
                      // Remove all error messages
                      .data('bv.messages')
                          .find('.help-block[data-bv-validator][data-bv-for="' + field + '"]').remove().end()
                          .end()
                      .removeData('bv.messages')
                      // Remove feedback classes
                      .parents(group)
                          .removeClass('has-feedback has-error has-success')
                          .end()
                      // Turn off events
                      .off('.bv')
                      .removeAttr('data-bv-field');

                  // Remove feedback icons, tooltip/popover container
                  $icon = $field.data('bv.icon');
                  if ($icon) {
                      var container = ('function' === typeof (this.options.fields[field].container || this.options.container)) ? (this.options.fields[field].container || this.options.container).call(this, $field, this) : (this.options.fields[field].container || this.options.container);
                      switch (container) {
                          case 'tooltip':
                              $icon.tooltip('destroy').remove();
                              break;
                          case 'popover':
                              $icon.popover('destroy').remove();
                              break;
                          default:
                              $icon.remove();
                              break;
                      }
                  }
                  $field.removeData('bv.icon');

                  for (validator in this.options.fields[field].validators) {
                      if ($field.data('bv.dfs.' + validator)) {
                          $field.data('bv.dfs.' + validator).reject();
                      }
                      $field.removeData('bv.result.' + validator)
                            .removeData('bv.response.' + validator)
                            .removeData('bv.dfs.' + validator);

                      // Destroy the validator
                      if ('function' === typeof $.fn.bootstrapValidator.validators[validator].destroy) {
                          $.fn.bootstrapValidator.validators[validator].destroy(this, $field, this.options.fields[field].validators[validator]);
                      }
                  }
              }
          }

          this.disableSubmitButtons(false);   // Enable submit buttons
          this.$hiddenButton.remove();        // Remove the hidden button

          this.$form
              .removeClass(this.options.elementClass)
              .off('.bv')
              .removeData('bootstrapValidator')
              // Remove generated hidden elements
              .find('[data-bv-submit-hidden]').remove().end()
              .find('[type="submit"]').off('click.bv');
      }
  };

  // Plugin definition
  $.fn.bootstrapValidator = function(option) {
      var params = arguments;
      return this.each(function() {
          var $this   = $(this),
              data    = $this.data('bootstrapValidator'),
              options = 'object' === typeof option && option;
          if (!data) {
              data = new BootstrapValidator(this, options);
              $this.data('bootstrapValidator', data);
          }

          // Allow to call plugin method
          if ('string' === typeof option) {
              data[option].apply(data, Array.prototype.slice.call(params, 1));
          }
      });
  };

  // The default options
  // Sorted in alphabetical order
  $.fn.bootstrapValidator.DEFAULT_OPTIONS = {
      // The first invalid field will be focused automatically
      autoFocus: true,

      //The error messages container. It can be:
      // - 'tooltip' if you want to use Bootstrap tooltip to show error messages
      // - 'popover' if you want to use Bootstrap popover to show error messages
      // - a CSS selector indicating the container
      // In the first two cases, since the tooltip/popover should be small enough, the plugin only shows only one error message
      // You also can define the message container for particular field
      container: null,

      // The form CSS class
      elementClass: 'bv-form',

      // Use custom event name to avoid window.onerror being invoked by jQuery
      // See https://github.com/nghuuphuoc/bootstrapvalidator/issues/630
      events: {
          formInit: 'init.form.bv',
          formError: 'error.form.bv',
          formSuccess: 'success.form.bv',
          fieldAdded: 'added.field.bv',
          fieldRemoved: 'removed.field.bv',
          fieldInit: 'init.field.bv',
          fieldError: 'error.field.bv',
          fieldSuccess: 'success.field.bv',
          fieldStatus: 'status.field.bv',
          validatorError: 'error.validator.bv',
          validatorSuccess: 'success.validator.bv'
      },

      // Indicate fields which won't be validated
      // By default, the plugin will not validate the following kind of fields:
      // - disabled
      // - hidden
      // - invisible
      //
      // The setting consists of jQuery filters. Accept 3 formats:
      // - A string. Use a comma to separate filter
      // - An array. Each element is a filter
      // - An array. Each element can be a callback function
      //      function($field, validator) {
      //          $field is jQuery object representing the field element
      //          validator is the BootstrapValidator instance
      //          return true or false;
      //      }
      //
      // The 3 following settings are equivalent:
      //
      // 1) ':disabled, :hidden, :not(:visible)'
      // 2) [':disabled', ':hidden', ':not(:visible)']
      // 3) [':disabled', ':hidden', function($field) {
      //        return !$field.is(':visible');
      //    }]
      excluded: [':disabled', ':hidden', ':not(:visible)'],

      // Shows ok/error/loading icons based on the field validity.
      // This feature requires Bootstrap v3.1.0 or later (http://getbootstrap.com/css/#forms-control-validation).
      // Since Bootstrap doesn't provide any methods to know its version, this option cannot be on/off automatically.
      // In other word, to use this feature you have to upgrade your Bootstrap to v3.1.0 or later.
      //
      // Examples:
      // - Use Glyphicons icons:
      //  feedbackIcons: {
      //      valid: 'glyphicon glyphicon-ok',
      //      invalid: 'glyphicon glyphicon-remove',
      //      validating: 'glyphicon glyphicon-refresh'
      //  }
      // - Use FontAwesome icons:
      //  feedbackIcons: {
      //      valid: 'fa fa-check',
      //      invalid: 'fa fa-times',
      //      validating: 'fa fa-refresh'
      //  }
      feedbackIcons: {
          valid:      null,
          invalid:    null,
          validating: null
      },

      // Map the field name with validator rules
      fields: null,

      // The CSS selector for indicating the element consists the field
      // By default, each field is placed inside the <div class="form-group"></div>
      // You should adjust this option if your form group consists of many fields which not all of them need to be validated
      group: '.form-group',

      // Live validating option
      // Can be one of 3 values:
      // - enabled: The plugin validates fields as soon as they are changed
      // - disabled: Disable the live validating. The error messages are only shown after the form is submitted
      // - submitted: The live validating is enabled after the form is submitted
      live: 'enabled',

      // Default invalid message
      message: 'This value is not valid',

      // The submit buttons selector
      // These buttons will be disabled to prevent the valid form from multiple submissions
      submitButtons: '[type="submit"]',

      // The field will not be live validated if its length is less than this number of characters
      threshold: null,

      // Whether to be verbose when validating a field or not.
      // Possible values:
      // - true:  when a field has multiple validators, all of them will be checked, and respectively - if errors occur in
      //          multiple validators, all of them will be displayed to the user
      // - false: when a field has multiple validators, validation for this field will be terminated upon the first encountered error.
      //          Thus, only the very first error message related to this field will be displayed to the user
      verbose: true
  };

  // Available validators
  $.fn.bootstrapValidator.validators  = {};

  // i18n
  $.fn.bootstrapValidator.i18n        = {};

  $.fn.bootstrapValidator.Constructor = BootstrapValidator;

  // Helper methods, which can be used in validator class
  $.fn.bootstrapValidator.helpers = {
      /**
       * Execute a callback function
       *
       * @param {String|Function} functionName Can be
       * - name of global function
       * - name of namespace function (such as A.B.C)
       * - a function
       * @param {Array} args The callback arguments
       */
      call: function(functionName, args) {
          if ('function' === typeof functionName) {
              return functionName.apply(this, args);
          } else if ('string' === typeof functionName) {
              if ('()' === functionName.substring(functionName.length - 2)) {
                  functionName = functionName.substring(0, functionName.length - 2);
              }
              var ns      = functionName.split('.'),
                  func    = ns.pop(),
                  context = window;
              for (var i = 0; i < ns.length; i++) {
                  context = context[ns[i]];
              }

              return (typeof context[func] === 'undefined') ? null : context[func].apply(this, args);
          }
      },

      /**
       * Format a string
       * It's used to format the error message
       * format('The field must between %s and %s', [10, 20]) = 'The field must between 10 and 20'
       *
       * @param {String} message
       * @param {Array} parameters
       * @returns {String}
       */
      format: function(message, parameters) {
          if (!$.isArray(parameters)) {
              parameters = [parameters];
          }

          for (var i in parameters) {
              message = message.replace('%s', parameters[i]);
          }

          return message;
      },

      /**
       * Validate a date
       *
       * @param {Number} year The full year in 4 digits
       * @param {Number} month The month number
       * @param {Number} day The day number
       * @param {Boolean} [notInFuture] If true, the date must not be in the future
       * @returns {Boolean}
       */
      date: function(year, month, day, notInFuture) {
          if (isNaN(year) || isNaN(month) || isNaN(day)) {
              return false;
          }
          if (day.length > 2 || month.length > 2 || year.length > 4) {
              return false;
          }

          day   = parseInt(day, 10);
          month = parseInt(month, 10);
          year  = parseInt(year, 10);

          if (year < 1000 || year > 9999 || month <= 0 || month > 12) {
              return false;
          }
          var numDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
          // Update the number of days in Feb of leap year
          if (year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0)) {
              numDays[1] = 29;
          }

          // Check the day
          if (day <= 0 || day > numDays[month - 1]) {
              return false;
          }

          if (notInFuture === true) {
              var currentDate  = new Date(),
                  currentYear  = currentDate.getFullYear(),
                  currentMonth = currentDate.getMonth(),
                  currentDay   = currentDate.getDate();
              return (year < currentYear
                      || (year === currentYear && month - 1 < currentMonth)
                      || (year === currentYear && month - 1 === currentMonth && day < currentDay));
          }

          return true;
      },

      /**
       * Implement Luhn validation algorithm
       * Credit to https://gist.github.com/ShirtlessKirk/2134376
       *
       * @see http://en.wikipedia.org/wiki/Luhn
       * @param {String} value
       * @returns {Boolean}
       */
      luhn: function(value) {
          var length  = value.length,
              mul     = 0,
              prodArr = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [0, 2, 4, 6, 8, 1, 3, 5, 7, 9]],
              sum     = 0;

          while (length--) {
              sum += prodArr[mul][parseInt(value.charAt(length), 10)];
              mul ^= 1;
          }

          return (sum % 10 === 0 && sum > 0);
      },

      /**
       * Implement modulus 11, 10 (ISO 7064) algorithm
       *
       * @param {String} value
       * @returns {Boolean}
       */
      mod11And10: function(value) {
          var check  = 5,
              length = value.length;
          for (var i = 0; i < length; i++) {
              check = (((check || 10) * 2) % 11 + parseInt(value.charAt(i), 10)) % 10;
          }
          return (check === 1);
      },

      /**
       * Implements Mod 37, 36 (ISO 7064) algorithm
       * Usages:
       * mod37And36('A12425GABC1234002M')
       * mod37And36('002006673085', '0123456789')
       *
       * @param {String} value
       * @param {String} [alphabet]
       * @returns {Boolean}
       */
      mod37And36: function(value, alphabet) {
          alphabet = alphabet || '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
          var modulus = alphabet.length,
              length  = value.length,
              check   = Math.floor(modulus / 2);
          for (var i = 0; i < length; i++) {
              check = (((check || modulus) * 2) % (modulus + 1) + alphabet.indexOf(value.charAt(i))) % modulus;
          }
          return (check === 1);
      }
  };
}(window.jQuery));
;(function($) {
  $.fn.bootstrapValidator.i18n.base64 = $.extend($.fn.bootstrapValidator.i18n.base64 || {}, {
      'default': 'Please enter a valid base 64 encoded'
  });

  $.fn.bootstrapValidator.validators.base64 = {
      /**
       * Return true if the input value is a base 64 encoded string.
       *
       * @param {BootstrapValidator} validator The validator plugin instance
       * @param {jQuery} $field Field element
       * @param {Object} options Can consist of the following keys:
       * - message: The invalid message
       * @returns {Boolean}
       */
      validate: function(validator, $field, options) {
          var value = $field.val();
          if (value === '') {
              return true;
          }

          return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})$/.test(value);
      }
  };
}(window.jQuery));
;(function($) {
  $.fn.bootstrapValidator.i18n.between = $.extend($.fn.bootstrapValidator.i18n.between || {}, {
      'default': 'Please enter a value between %s and %s',
      notInclusive: 'Please enter a value between %s and %s strictly'
  });

  $.fn.bootstrapValidator.validators.between = {
      html5Attributes: {
          message: 'message',
          min: 'min',
          max: 'max',
          inclusive: 'inclusive'
      },

      enableByHtml5: function($field) {
          if ('range' === $field.attr('type')) {
              return {
                  min: $field.attr('min'),
                  max: $field.attr('max')
              };
          }

          return false;
      },

      /**
       * Return true if the input value is between (strictly or not) two given numbers
       *
       * @param {BootstrapValidator} validator The validator plugin instance
       * @param {jQuery} $field Field element
       * @param {Object} options Can consist of the following keys:
       * - min
       * - max
       *
       * The min, max keys define the number which the field value compares to. min, max can be
       *      - A number
       *      - Name of field which its value defines the number
       *      - Name of callback function that returns the number
       *      - A callback function that returns the number
       *
       * - inclusive [optional]: Can be true or false. Default is true
       * - message: The invalid message
       * @returns {Boolean|Object}
       */
      validate: function(validator, $field, options) {
          var value = $field.val();
          if (value === '') {
              return true;
          }

    value = this._format(value);
          if (!$.isNumeric(value)) {
              return false;
          }

          var min      = $.isNumeric(options.min) ? options.min : validator.getDynamicOption($field, options.min),
              max      = $.isNumeric(options.max) ? options.max : validator.getDynamicOption($field, options.max),
              minValue = this._format(min),
              maxValue = this._format(max);

          value = parseFloat(value);
    return (options.inclusive === true || options.inclusive === undefined)
                  ? {
                      valid: value >= minValue && value <= maxValue,
                      message: $.fn.bootstrapValidator.helpers.format(options.message || $.fn.bootstrapValidator.i18n.between['default'], [min, max])
                  }
                  : {
                      valid: value > minValue  && value <  maxValue,
                      message: $.fn.bootstrapValidator.helpers.format(options.message || $.fn.bootstrapValidator.i18n.between.notInclusive, [min, max])
                  };
      },

      _format: function(value) {
          return (value + '').replace(',', '.');
      }
  };
}(window.jQuery));
;(function($) {
  $.fn.bootstrapValidator.validators.blank = {
      /**
       * Placeholder validator that can be used to display a custom validation message
       * returned from the server
       * Example:
       *
       * (1) a "blank" validator is applied to an input field.
       * (2) data is entered via the UI that is unable to be validated client-side.
       * (3) server returns a 400 with JSON data that contains the field that failed
       *     validation and an associated message.
       * (4) ajax 400 call handler does the following:
       *
       *      bv.updateMessage(field, 'blank', errorMessage);
       *      bv.updateStatus(field, 'INVALID');
       *
       * @see https://github.com/nghuuphuoc/bootstrapvalidator/issues/542
       * @see https://github.com/nghuuphuoc/bootstrapvalidator/pull/666
       * @param {BootstrapValidator} validator The validator plugin instance
       * @param {jQuery} $field Field element
       * @param {Object} options Can consist of the following keys:
       * - message: The invalid message
       * @returns {Boolean}
       */
      validate: function(validator, $field, options) {
          return true;
      }
  };
}(window.jQuery));
;(function($) {
  $.fn.bootstrapValidator.i18n.callback = $.extend($.fn.bootstrapValidator.i18n.callback || {}, {
      'default': 'Please enter a valid value'
  });

  $.fn.bootstrapValidator.validators.callback = {
      html5Attributes: {
          message: 'message',
          callback: 'callback'
      },

      /**
       * Return result from the callback method
       *
       * @param {BootstrapValidator} validator The validator plugin instance
       * @param {jQuery} $field Field element
       * @param {Object} options Can consist of the following keys:
       * - callback: The callback method that passes 2 parameters:
       *      callback: function(fieldValue, validator, $field) {
       *          // fieldValue is the value of field
       *          // validator is instance of BootstrapValidator
       *          // $field is the field element
       *      }
       * - message: The invalid message
       * @returns {Deferred}
       */
      validate: function(validator, $field, options) {
          var value  = $field.val(),
              dfd    = new $.Deferred(),
              result = { valid: true };

          if (options.callback) {
              var response = $.fn.bootstrapValidator.helpers.call(options.callback, [value, validator, $field]);
              result = ('boolean' === typeof response) ? { valid: response } :  response;
          }

          dfd.resolve($field, 'callback', result);
          return dfd;
      }
  };
}(window.jQuery));
;(function($) {
  $.fn.bootstrapValidator.i18n.choice = $.extend($.fn.bootstrapValidator.i18n.choice || {}, {
      'default': 'Please enter a valid value',
      less: 'Please choose %s options at minimum',
      more: 'Please choose %s options at maximum',
      between: 'Please choose %s - %s options'
  });

  $.fn.bootstrapValidator.validators.choice = {
      html5Attributes: {
          message: 'message',
          min: 'min',
          max: 'max'
      },

      /**
       * Check if the number of checked boxes are less or more than a given number
       *
       * @param {BootstrapValidator} validator The validator plugin instance
       * @param {jQuery} $field Field element
       * @param {Object} options Consists of following keys:
       * - min
       * - max
       *
       * At least one of two keys is required
       * The min, max keys define the number which the field value compares to. min, max can be
       *      - A number
       *      - Name of field which its value defines the number
       *      - Name of callback function that returns the number
       *      - A callback function that returns the number
       *
       * - message: The invalid message
       * @returns {Object}
       */
      validate: function(validator, $field, options) {
          var numChoices = $field.is('select')
                          ? validator.getFieldElements($field.attr('data-bv-field')).find('option').filter(':selected').length
                          : validator.getFieldElements($field.attr('data-bv-field')).filter(':checked').length,
              min        = options.min ? ($.isNumeric(options.min) ? options.min : validator.getDynamicOption($field, options.min)) : null,
              max        = options.max ? ($.isNumeric(options.max) ? options.max : validator.getDynamicOption($field, options.max)) : null,
              isValid    = true,
              message    = options.message || $.fn.bootstrapValidator.i18n.choice['default'];

          if ((min && numChoices < parseInt(min, 10)) || (max && numChoices > parseInt(max, 10))) {
              isValid = false;
          }

          switch (true) {
              case (!!min && !!max):
                  message = $.fn.bootstrapValidator.helpers.format(options.message || $.fn.bootstrapValidator.i18n.choice.between, [parseInt(min, 10), parseInt(max, 10)]);
                  break;

              case (!!min):
                  message = $.fn.bootstrapValidator.helpers.format(options.message || $.fn.bootstrapValidator.i18n.choice.less, parseInt(min, 10));
                  break;

              case (!!max):
                  message = $.fn.bootstrapValidator.helpers.format(options.message || $.fn.bootstrapValidator.i18n.choice.more, parseInt(max, 10));
                  break;

              default:
                  break;
          }

          return { valid: isValid, message: message };
      }
  };
}(window.jQuery));
;(function($) {
  $.fn.bootstrapValidator.i18n.color = $.extend($.fn.bootstrapValidator.i18n.color || {}, {
      'default': 'Please enter a valid color'
  });

  $.fn.bootstrapValidator.validators.color = {
      SUPPORTED_TYPES: [
          'hex', 'rgb', 'rgba', 'hsl', 'hsla', 'keyword'
      ],

      KEYWORD_COLORS: [
          // Colors start with A
          'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure',
          // B
          'beige', 'bisque', 'black', 'blanchedalmond', 'blue', 'blueviolet', 'brown', 'burlywood',
          // C
          'cadetblue', 'chartreuse', 'chocolate', 'coral', 'cornflowerblue', 'cornsilk', 'crimson', 'cyan',
          // D
          'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey', 'darkkhaki', 'darkmagenta',
          'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen', 'darkslateblue',
          'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink', 'deepskyblue', 'dimgray',
          'dimgrey', 'dodgerblue',
          // F
          'firebrick', 'floralwhite', 'forestgreen', 'fuchsia',
          // G
          'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'gray', 'green', 'greenyellow', 'grey',
          // H
          'honeydew', 'hotpink',
          // I
          'indianred', 'indigo', 'ivory',
          // K
          'khaki',
          // L
          'lavender', 'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan',
          'lightgoldenrodyellow', 'lightgray', 'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon', 'lightseagreen',
          'lightskyblue', 'lightslategray', 'lightslategrey', 'lightsteelblue', 'lightyellow', 'lime', 'limegreen',
          'linen',
          // M
          'magenta', 'maroon', 'mediumaquamarine', 'mediumblue', 'mediumorchid', 'mediumpurple', 'mediumseagreen',
          'mediumslateblue', 'mediumspringgreen', 'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream',
          'mistyrose', 'moccasin',
          // N
          'navajowhite', 'navy',
          // O
          'oldlace', 'olive', 'olivedrab', 'orange', 'orangered', 'orchid',
          // P
          'palegoldenrod', 'palegreen', 'paleturquoise', 'palevioletred', 'papayawhip', 'peachpuff', 'peru', 'pink',
          'plum', 'powderblue', 'purple',
          // R
          'red', 'rosybrown', 'royalblue',
          // S
          'saddlebrown', 'salmon', 'sandybrown', 'seagreen', 'seashell', 'sienna', 'silver', 'skyblue', 'slateblue',
          'slategray', 'slategrey', 'snow', 'springgreen', 'steelblue',
          // T
          'tan', 'teal', 'thistle', 'tomato', 'transparent', 'turquoise',
          // V
          'violet',
          // W
          'wheat', 'white', 'whitesmoke',
          // Y
          'yellow', 'yellowgreen'
      ],

      /**
       * Return true if the input value is a valid color
       *
       * @param {BootstrapValidator} validator The validator plugin instance
       * @param {jQuery} $field Field element
       * @param {Object} options Can consist of the following keys:
       * - message: The invalid message
       * - type: The array of valid color types
       * @returns {Boolean}
       */
      validate: function(validator, $field, options) {
          var value = $field.val();
          if (value === '') {
              return true;
          }

          var types = options.type || this.SUPPORTED_TYPES;
          if (!$.isArray(types)) {
              types = types.replace(/s/g, '').split(',');
          }

          var method,
              type,
              isValid = false;

          for (var i = 0; i < types.length; i++) {
              type    = types[i];
              method  = '_' + type.toLowerCase();
              isValid = isValid || this[method](value);
              if (isValid) {
                  return true;
              }
          }

          return false;
      },

      _hex: function(value) {
          return /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(value);
      },

      _hsl: function(value) {
          return /^hsl\((\s*(-?\d+)\s*,)(\s*(\b(0?\d{1,2}|100)\b%)\s*,)(\s*(\b(0?\d{1,2}|100)\b%)\s*)\)$/.test(value);
      },

      _hsla: function(value) {
          return /^hsla\((\s*(-?\d+)\s*,)(\s*(\b(0?\d{1,2}|100)\b%)\s*,){2}(\s*(0?(\.\d+)?|1(\.0+)?)\s*)\)$/.test(value);
      },

      _keyword: function(value) {
          return $.inArray(value, this.KEYWORD_COLORS) >= 0;
      },

      _rgb: function(value) {
          var regexInteger = /^rgb\((\s*(\b([01]?\d{1,2}|2[0-4]\d|25[0-5])\b)\s*,){2}(\s*(\b([01]?\d{1,2}|2[0-4]\d|25[0-5])\b)\s*)\)$/,
              regexPercent = /^rgb\((\s*(\b(0?\d{1,2}|100)\b%)\s*,){2}(\s*(\b(0?\d{1,2}|100)\b%)\s*)\)$/;
          return regexInteger.test(value) || regexPercent.test(value);
      },

      _rgba: function(value) {
          var regexInteger = /^rgba\((\s*(\b([01]?\d{1,2}|2[0-4]\d|25[0-5])\b)\s*,){3}(\s*(0?(\.\d+)?|1(\.0+)?)\s*)\)$/,
              regexPercent = /^rgba\((\s*(\b(0?\d{1,2}|100)\b%)\s*,){3}(\s*(0?(\.\d+)?|1(\.0+)?)\s*)\)$/;
          return regexInteger.test(value) || regexPercent.test(value);
      }
  };
}(window.jQuery));
;(function($) {
  $.fn.bootstrapValidator.i18n.creditCard = $.extend($.fn.bootstrapValidator.i18n.creditCard || {}, {
      'default': 'Please enter a valid credit card number'
  });

  $.fn.bootstrapValidator.validators.creditCard = {
      /**
       * Return true if the input value is valid credit card number
       * Based on https://gist.github.com/DiegoSalazar/4075533
       *
       * @param {BootstrapValidator} validator The validator plugin instance
       * @param {jQuery} $field Field element
       * @param {Object} [options] Can consist of the following key:
       * - message: The invalid message
       * @returns {Boolean}
       */
      validate: function(validator, $field, options) {
          var value = $field.val();
          if (value === '') {
              return true;
          }

          // Accept only digits, dashes or spaces
          if (/[^0-9-\s]+/.test(value)) {
              return false;
          }
          value = value.replace(/\D/g, '');

          if (!$.fn.bootstrapValidator.helpers.luhn(value)) {
              return false;
          }

          // Validate the card number based on prefix (IIN ranges) and length
          var cards = {
              AMERICAN_EXPRESS: {
                  length: [15],
                  prefix: ['34', '37']
              },
              DINERS_CLUB: {
                  length: [14],
                  prefix: ['300', '301', '302', '303', '304', '305', '36']
              },
              DINERS_CLUB_US: {
                  length: [16],
                  prefix: ['54', '55']
              },
              DISCOVER: {
                  length: [16],
                  prefix: ['6011', '622126', '622127', '622128', '622129', '62213',
                           '62214', '62215', '62216', '62217', '62218', '62219',
                           '6222', '6223', '6224', '6225', '6226', '6227', '6228',
                           '62290', '62291', '622920', '622921', '622922', '622923',
                           '622924', '622925', '644', '645', '646', '647', '648',
                           '649', '65']
              },
              JCB: {
                  length: [16],
                  prefix: ['3528', '3529', '353', '354', '355', '356', '357', '358']
              },
              LASER: {
                  length: [16, 17, 18, 19],
                  prefix: ['6304', '6706', '6771', '6709']
              },
              MAESTRO: {
                  length: [12, 13, 14, 15, 16, 17, 18, 19],
                  prefix: ['5018', '5020', '5038', '6304', '6759', '6761', '6762', '6763', '6764', '6765', '6766']
              },
              MASTERCARD: {
                  length: [16],
                  prefix: ['51', '52', '53', '54', '55']
              },
              SOLO: {
                  length: [16, 18, 19],
                  prefix: ['6334', '6767']
              },
              UNIONPAY: {
                  length: [16, 17, 18, 19],
                  prefix: ['622126', '622127', '622128', '622129', '62213', '62214',
                           '62215', '62216', '62217', '62218', '62219', '6222', '6223',
                           '6224', '6225', '6226', '6227', '6228', '62290', '62291',
                           '622920', '622921', '622922', '622923', '622924', '622925']
              },
              VISA: {
                  length: [16],
                  prefix: ['4']
              }
          };

          var type, i;
          for (type in cards) {
              for (i in cards[type].prefix) {
                  if (value.substr(0, cards[type].prefix[i].length) === cards[type].prefix[i]     // Check the prefix
                      && $.inArray(value.length, cards[type].length) !== -1)                      // and length
                  {
                      return true;
                  }
              }
          }

          return false;
      }
  };
}(window.jQuery));
;(function($) {
  $.fn.bootstrapValidator.i18n.cusip = $.extend($.fn.bootstrapValidator.i18n.cusip || {}, {
      'default': 'Please enter a valid CUSIP number'
  });

  $.fn.bootstrapValidator.validators.cusip = {
      /**
       * Validate a CUSIP
       * Examples:
       * - Valid: 037833100, 931142103, 14149YAR8, 126650BG6
       * - Invalid: 31430F200, 022615AC2
       *
       * @see http://en.wikipedia.org/wiki/CUSIP
       * @param {BootstrapValidator} validator The validator plugin instance
       * @param {jQuery} $field Field element
       * @param {Object} [options] Can consist of the following keys:
       * - message: The invalid message
       * @returns {Boolean}
       */
      validate: function(validator, $field, options) {
          var value = $field.val();
          if (value === '') {
              return true;
          }

          value = value.toUpperCase();
          if (!/^[0-9A-Z]{9}$/.test(value)) {
              return false;
          }

          var converted = $.map(value.split(''), function(item) {
                              var code = item.charCodeAt(0);
                              return (code >= 'A'.charCodeAt(0) && code <= 'Z'.charCodeAt(0))
                                          // Replace A, B, C, ..., Z with 10, 11, ..., 35
                                          ? (code - 'A'.charCodeAt(0) + 10)
                                          : item;
                          }),
              length    = converted.length,
              sum       = 0;
          for (var i = 0; i < length - 1; i++) {
              var num = parseInt(converted[i], 10);
              if (i % 2 !== 0) {
                  num *= 2;
              }
              if (num > 9) {
                  num -= 9;
              }
              sum += num;
          }

          sum = (10 - (sum % 10)) % 10;
          return sum === converted[length - 1];
      }
  };
}(window.jQuery));
;(function($) {
  $.fn.bootstrapValidator.i18n.cvv = $.extend($.fn.bootstrapValidator.i18n.cvv || {}, {
      'default': 'Please enter a valid CVV number'
  });

  $.fn.bootstrapValidator.validators.cvv = {
      html5Attributes: {
          message: 'message',
          ccfield: 'creditCardField'
      },

      /**
       * Return true if the input value is a valid CVV number.
       *
       * @param {BootstrapValidator} validator The validator plugin instance
       * @param {jQuery} $field Field element
       * @param {Object} options Can consist of the following keys:
       * - creditCardField: The credit card number field. It can be null
       * - message: The invalid message
       * @returns {Boolean}
       */
      validate: function(validator, $field, options) {
          var value = $field.val();
          if (value === '') {
              return true;
          }

          if (!/^[0-9]{3,4}$/.test(value)) {
              return false;
          }

          if (!options.creditCardField) {
              return true;
          }

          // Get the credit card number
          var creditCard = validator.getFieldElements(options.creditCardField).val();
          if (creditCard === '') {
              return true;
          }
          
          creditCard = creditCard.replace(/\D/g, '');

          // Supported credit card types
          var cards = {
              AMERICAN_EXPRESS: {
                  length: [15],
                  prefix: ['34', '37']
              },
              DINERS_CLUB: {
                  length: [14],
                  prefix: ['300', '301', '302', '303', '304', '305', '36']
              },
              DINERS_CLUB_US: {
                  length: [16],
                  prefix: ['54', '55']
              },
              DISCOVER: {
                  length: [16],
                  prefix: ['6011', '622126', '622127', '622128', '622129', '62213',
                           '62214', '62215', '62216', '62217', '62218', '62219',
                           '6222', '6223', '6224', '6225', '6226', '6227', '6228',
                           '62290', '62291', '622920', '622921', '622922', '622923',
                           '622924', '622925', '644', '645', '646', '647', '648',
                           '649', '65']
              },
              JCB: {
                  length: [16],
                  prefix: ['3528', '3529', '353', '354', '355', '356', '357', '358']
              },
              LASER: {
                  length: [16, 17, 18, 19],
                  prefix: ['6304', '6706', '6771', '6709']
              },
              MAESTRO: {
                  length: [12, 13, 14, 15, 16, 17, 18, 19],
                  prefix: ['5018', '5020', '5038', '6304', '6759', '6761', '6762', '6763', '6764', '6765', '6766']
              },
              MASTERCARD: {
                  length: [16],
                  prefix: ['51', '52', '53', '54', '55']
              },
              SOLO: {
                  length: [16, 18, 19],
                  prefix: ['6334', '6767']
              },
              UNIONPAY: {
                  length: [16, 17, 18, 19],
                  prefix: ['622126', '622127', '622128', '622129', '62213', '62214',
                           '62215', '62216', '62217', '62218', '62219', '6222', '6223',
                           '6224', '6225', '6226', '6227', '6228', '62290', '62291',
                           '622920', '622921', '622922', '622923', '622924', '622925']
              },
              VISA: {
                  length: [16],
                  prefix: ['4']
              }
          };
          var type, i, creditCardType = null;
          for (type in cards) {
              for (i in cards[type].prefix) {
                  if (creditCard.substr(0, cards[type].prefix[i].length) === cards[type].prefix[i]    // Check the prefix
                      && $.inArray(creditCard.length, cards[type].length) !== -1)                     // and length
                  {
                      creditCardType = type;
                      break;
                  }
              }
          }

          return (creditCardType === null)
                      ? false
                      : (('AMERICAN_EXPRESS' === creditCardType) ? (value.length === 4) : (value.length === 3));
      }
  };
}(window.jQuery));
;(function($) {
  $.fn.bootstrapValidator.i18n.date = $.extend($.fn.bootstrapValidator.i18n.date || {}, {
      'default': 'Please enter a valid date',
      min: 'Please enter a date after %s',
      max: 'Please enter a date before %s',
      range: 'Please enter a date in the range %s - %s'
  });

  $.fn.bootstrapValidator.validators.date = {
      html5Attributes: {
          message: 'message',
          format: 'format',
          min: 'min',
          max: 'max',
          separator: 'separator'
      },

      /**
       * Return true if the input value is valid date
       *
       * @param {BootstrapValidator} validator The validator plugin instance
       * @param {jQuery} $field Field element
       * @param {Object} options Can consist of the following keys:
       * - message: The invalid message
       * - min: the minimum date
       * - max: the maximum date
       * - separator: Use to separate the date, month, and year.
       * By default, it is /
       * - format: The date format. Default is MM/DD/YYYY
       * The format can be:
       *
       * i) date: Consist of DD, MM, YYYY parts which are separated by the separator option
       * ii) date and time:
       * The time can consist of h, m, s parts which are separated by :
       * ii) date, time and A (indicating AM or PM)
       * @returns {Boolean|Object}
       */
      validate: function(validator, $field, options) {
          var value = $field.val();
          if (value === '') {
              return true;
          }

          options.format = options.format || 'MM/DD/YYYY';

          // #683: Force the format to YYYY-MM-DD as the default browser behaviour when using type="date" attribute
          if ($field.attr('type') === 'date') {
              options.format = 'YYYY-MM-DD';
          }

          var formats    = options.format.split(' '),
              dateFormat = formats[0],
              timeFormat = (formats.length > 1) ? formats[1] : null,
              amOrPm     = (formats.length > 2) ? formats[2] : null,
              sections   = value.split(' '),
              date       = sections[0],
              time       = (sections.length > 1) ? sections[1] : null;

          if (formats.length !== sections.length) {
              return {
                  valid: false,
                  message: options.message || $.fn.bootstrapValidator.i18n.date['default']
              };
          }

          // Determine the separator
          var separator = options.separator;
          if (!separator) {
              separator = (date.indexOf('/') !== -1) ? '/' : ((date.indexOf('-') !== -1) ? '-' : null);
          }
          if (separator === null || date.indexOf(separator) === -1) {
              return {
                  valid: false,
                  message: options.message || $.fn.bootstrapValidator.i18n.date['default']
              };
          }

          // Determine the date
          date       = date.split(separator);
          dateFormat = dateFormat.split(separator);
          if (date.length !== dateFormat.length) {
              return {
                  valid: false,
                  message: options.message || $.fn.bootstrapValidator.i18n.date['default']
              };
          }

          var year  = date[$.inArray('YYYY', dateFormat)],
              month = date[$.inArray('MM', dateFormat)],
              day   = date[$.inArray('DD', dateFormat)];

          if (!year || !month || !day || year.length !== 4) {
              return {
                  valid: false,
                  message: options.message || $.fn.bootstrapValidator.i18n.date['default']
              };
          }

          // Determine the time
          var minutes = null, hours = null, seconds = null;
          if (timeFormat) {
              timeFormat = timeFormat.split(':');
              time       = time.split(':');

              if (timeFormat.length !== time.length) {
                  return {
                      valid: false,
                      message: options.message || $.fn.bootstrapValidator.i18n.date['default']
                  };
              }

              hours   = time.length > 0 ? time[0] : null;
              minutes = time.length > 1 ? time[1] : null;
              seconds = time.length > 2 ? time[2] : null;

              // Validate seconds
              if (seconds) {
                  if (isNaN(seconds) || seconds.length > 2) {
                      return {
                          valid: false,
                          message: options.message || $.fn.bootstrapValidator.i18n.date['default']
                      };
                  }
                  seconds = parseInt(seconds, 10);
                  if (seconds < 0 || seconds > 60) {
                      return {
                          valid: false,
                          message: options.message || $.fn.bootstrapValidator.i18n.date['default']
                      };
                  }
              }

              // Validate hours
              if (hours) {
                  if (isNaN(hours) || hours.length > 2) {
                      return {
                          valid: false,
                          message: options.message || $.fn.bootstrapValidator.i18n.date['default']
                      };
                  }
                  hours = parseInt(hours, 10);
                  if (hours < 0 || hours >= 24 || (amOrPm && hours > 12)) {
                      return {
                          valid: false,
                          message: options.message || $.fn.bootstrapValidator.i18n.date['default']
                      };
                  }
              }

              // Validate minutes
              if (minutes) {
                  if (isNaN(minutes) || minutes.length > 2) {
                      return {
                          valid: false,
                          message: options.message || $.fn.bootstrapValidator.i18n.date['default']
                      };
                  }
                  minutes = parseInt(minutes, 10);
                  if (minutes < 0 || minutes > 59) {
                      return {
                          valid: false,
                          message: options.message || $.fn.bootstrapValidator.i18n.date['default']
                      };
                  }
              }
          }

          // Validate day, month, and year
          var valid   = $.fn.bootstrapValidator.helpers.date(year, month, day),
              message = options.message || $.fn.bootstrapValidator.i18n.date['default'];

          // declare the date, min and max objects
          var min       = null,
              max       = null,
              minOption = options.min,
              maxOption = options.max;

          if (minOption) {
              if (isNaN(Date.parse(minOption))) {
                  minOption = validator.getDynamicOption($field, minOption);
              }
              min = this._parseDate(minOption, dateFormat, separator);
          }

          if (maxOption) {
              if (isNaN(Date.parse(maxOption))) {
                  maxOption = validator.getDynamicOption($field, maxOption);
              }
              max = this._parseDate(maxOption, dateFormat, separator);
          }

          date = new Date(year, month, day, hours, minutes, seconds);

          switch (true) {
              case (minOption && !maxOption && valid):
                  valid   = date.getTime() >= min.getTime();
                  message = options.message || $.fn.bootstrapValidator.helpers.format($.fn.bootstrapValidator.i18n.date.min, minOption);
                  break;

              case (maxOption && !minOption && valid):
                  valid   = date.getTime() <= max.getTime();
                  message = options.message || $.fn.bootstrapValidator.helpers.format($.fn.bootstrapValidator.i18n.date.max, maxOption);
                  break;

              case (maxOption && minOption && valid):
                  valid   = date.getTime() <= max.getTime() && date.getTime() >= min.getTime();
                  message = options.message || $.fn.bootstrapValidator.helpers.format($.fn.bootstrapValidator.i18n.date.range, [minOption, maxOption]);
                  break;

              default:
                  break;
          }

          return {
              valid: valid,
              message: message
          };
      },

      /**
       * Return a date object after parsing the date string
       *
       * @param {String} date   The date string to parse
       * @param {String} format The date format
       * The format can be:
       *   - date: Consist of DD, MM, YYYY parts which are separated by the separator option
       *   - date and time:
       *     The time can consist of h, m, s parts which are separated by :
       * @param {String} separator The separator used to separate the date, month, and year
       * @returns {Date}
       */
      _parseDate: function(date, format, separator) {
          var minutes     = 0, hours = 0, seconds = 0,
              sections    = date.split(' '),
              dateSection = sections[0],
              timeSection = (sections.length > 1) ? sections[1] : null;

          dateSection = dateSection.split(separator);
          var year  = dateSection[$.inArray('YYYY', format)],
              month = dateSection[$.inArray('MM', format)],
              day   = dateSection[$.inArray('DD', format)];
          if (timeSection) {
              timeSection = timeSection.split(':');
              hours       = timeSection.length > 0 ? timeSection[0] : null;
              minutes     = timeSection.length > 1 ? timeSection[1] : null;
              seconds     = timeSection.length > 2 ? timeSection[2] : null;
          }

          return new Date(year, month, day, hours, minutes, seconds);
      }
  };
}(window.jQuery));
;(function($) {
  $.fn.bootstrapValidator.i18n.different = $.extend($.fn.bootstrapValidator.i18n.different || {}, {
      'default': 'Please enter a different value'
  });

  $.fn.bootstrapValidator.validators.different = {
      html5Attributes: {
          message: 'message',
          field: 'field'
      },

      /**
       * Return true if the input value is different with given field's value
       *
       * @param {BootstrapValidator} validator The validator plugin instance
       * @param {jQuery} $field Field element
       * @param {Object} options Consists of the following key:
       * - field: The name of field that will be used to compare with current one
       * - message: The invalid message
       * @returns {Boolean}
       */
      validate: function(validator, $field, options) {
          var value = $field.val();
          if (value === '') {
              return true;
          }

          var fields  = options.field.split(','),
              isValid = true;

          for (var i = 0; i < fields.length; i++) {
              var compareWith = validator.getFieldElements(fields[i]);
              if (compareWith == null || compareWith.length === 0) {
                  continue;
              }

              var compareValue = compareWith.val();
              if (value === compareValue) {
                  isValid = false;
              } else if (compareValue !== '') {
                  validator.updateStatus(compareWith, validator.STATUS_VALID, 'different');
              }
          }

          return isValid;
      }
  };
}(window.jQuery));
;(function($) {
  $.fn.bootstrapValidator.i18n.digits = $.extend($.fn.bootstrapValidator.i18n.digits || {}, {
      'default': 'Please enter only digits'
  });

  $.fn.bootstrapValidator.validators.digits = {
      /**
       * Return true if the input value contains digits only
       *
       * @param {BootstrapValidator} validator Validate plugin instance
       * @param {jQuery} $field Field element
       * @param {Object} [options]
       * @returns {Boolean}
       */
      validate: function(validator, $field, options) {
          var value = $field.val();
          if (value === '') {
              return true;
          }

          return /^\d+$/.test(value);
      }
  };
}(window.jQuery));
;(function($) {
  $.fn.bootstrapValidator.i18n.ean = $.extend($.fn.bootstrapValidator.i18n.ean || {}, {
      'default': 'Please enter a valid EAN number'
  });

  $.fn.bootstrapValidator.validators.ean = {
      /**
       * Validate EAN (International Article Number)
       * Examples:
       * - Valid: 73513537, 9780471117094, 4006381333931
       * - Invalid: 73513536
       *
       * @see http://en.wikipedia.org/wiki/European_Article_Number
       * @param {BootstrapValidator} validator The validator plugin instance
       * @param {jQuery} $field Field element
       * @param {Object} options Can consist of the following keys:
       * - message: The invalid message
       * @returns {Boolean}
       */
      validate: function(validator, $field, options) {
          var value = $field.val();
          if (value === '') {
              return true;
          }

          if (!/^(\d{8}|\d{12}|\d{13})$/.test(value)) {
              return false;
          }

          var length = value.length,
              sum    = 0,
              weight = (length === 8) ? [3, 1] : [1, 3];
          for (var i = 0; i < length - 1; i++) {
              sum += parseInt(value.charAt(i), 10) * weight[i % 2];
          }
          sum = (10 - sum % 10) % 10;
          return (sum + '' === value.charAt(length - 1));
      }
  };
}(window.jQuery));
;(function($) {
  $.fn.bootstrapValidator.i18n.emailAddress = $.extend($.fn.bootstrapValidator.i18n.emailAddress || {}, {
      'default': 'Please enter a valid email address'
  });

  $.fn.bootstrapValidator.validators.emailAddress = {
      html5Attributes: {
          message: 'message',
          multiple: 'multiple',
          separator: 'separator'
      },

      enableByHtml5: function($field) {
          return ('email' === $field.attr('type'));
      },

      /**
       * Return true if and only if the input value is a valid email address
       *
       * @param {BootstrapValidator} validator Validate plugin instance
       * @param {jQuery} $field Field element
       * @param {Object} [options]
       * - multiple: Allow multiple email addresses, separated by a comma or semicolon; default is false.
       * - separator: Regex for character or characters expected as separator between addresses; default is comma /[,;]/, i.e. comma or semicolon.
       * @returns {Boolean}
       */
      validate: function(validator, $field, options) {
          var value = $field.val();
          if (value === '') {
              return true;
          }

          // Email address regular expression
          // http://stackoverflow.com/questions/46155/validate-email-address-in-javascript
          var emailRegExp   = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
              allowMultiple = options.multiple === true || options.multiple === 'true';

          if (allowMultiple) {
              var separator = options.separator || /[,;]/,
                  addresses = this._splitEmailAddresses(value, separator);

              for (var i = 0; i < addresses.length; i++) {
                  if (!emailRegExp.test(addresses[i])) {
                      return false;
                  }
              }

              return true;
          } else {
              return emailRegExp.test(value);
          }
      },

      _splitEmailAddresses: function(emailAddresses, separator) {
          var quotedFragments     = emailAddresses.split(/"/),
              quotedFragmentCount = quotedFragments.length,
              emailAddressArray   = [],
              nextEmailAddress    = '';

          for (var i = 0; i < quotedFragmentCount; i++) {
              if (i % 2 === 0) {
                  var splitEmailAddressFragments     = quotedFragments[i].split(separator),
                      splitEmailAddressFragmentCount = splitEmailAddressFragments.length;

                  if (splitEmailAddressFragmentCount === 1) {
                      nextEmailAddress += splitEmailAddressFragments[0];
                  } else {
                      emailAddressArray.push(nextEmailAddress + splitEmailAddressFragments[0]);

                      for (var j = 1; j < splitEmailAddressFragmentCount - 1; j++) {
                          emailAddressArray.push(splitEmailAddressFragments[j]);
                      }
                      nextEmailAddress = splitEmailAddressFragments[splitEmailAddressFragmentCount - 1];
                  }
              } else {
                  nextEmailAddress += '"' + quotedFragments[i];
                  if (i < quotedFragmentCount - 1) {
                      nextEmailAddress += '"';
                  }
              }
          }

          emailAddressArray.push(nextEmailAddress);
          return emailAddressArray;
      }
  };
}(window.jQuery));
;(function($) {
  $.fn.bootstrapValidator.i18n.file = $.extend($.fn.bootstrapValidator.i18n.file || {}, {
      'default': 'Please choose a valid file'
  });

  $.fn.bootstrapValidator.validators.file = {
      html5Attributes: {
          extension: 'extension',
          maxfiles: 'maxFiles',
          minfiles: 'minFiles',
          maxsize: 'maxSize',
          minsize: 'minSize',
          maxtotalsize: 'maxTotalSize',
          mintotalsize: 'minTotalSize',
          message: 'message',
          type: 'type'
      },

      /**
       * Validate upload file. Use HTML 5 API if the browser supports
       *
       * @param {BootstrapValidator} validator The validator plugin instance
       * @param {jQuery} $field Field element
       * @param {Object} options Can consist of the following keys:
       * - extension: The allowed extensions, separated by a comma
       * - maxFiles: The maximum number of files
       * - minFiles: The minimum number of files
       * - maxSize: The maximum size in bytes
       * - minSize: The minimum size in bytes
       * - maxTotalSize: The maximum size in bytes for all files
       * - minTotalSize: The minimum size in bytes for all files
       * - message: The invalid message
       * - type: The allowed MIME type, separated by a comma
       * @returns {Boolean}
       */
      validate: function(validator, $field, options) {
          var value = $field.val();
          if (value === '') {
              return true;
          }

          var ext,
              extensions = options.extension ? options.extension.toLowerCase().split(',') : null,
              types      = options.type      ? options.type.toLowerCase().split(',')      : null,
              html5      = (window.File && window.FileList && window.FileReader);

          if (html5) {
              // Get FileList instance
              var files     = $field.get(0).files,
                  total     = files.length,
                  totalSize = 0;

              if ((options.maxFiles && total > parseInt(options.maxFiles, 10))        // Check the maxFiles
                  || (options.minFiles && total < parseInt(options.minFiles, 10)))    // Check the minFiles
              {
                  return false;
              }

              for (var i = 0; i < total; i++) {
                  totalSize += files[i].size;
                  ext        = files[i].name.substr(files[i].name.lastIndexOf('.') + 1);

                  if ((options.minSize && files[i].size < parseInt(options.minSize, 10))                      // Check the minSize
                      || (options.maxSize && files[i].size > parseInt(options.maxSize, 10))                   // Check the maxSize
                      || (extensions && $.inArray(ext.toLowerCase(), extensions) === -1)                      // Check file extension
                      || (files[i].type && types && $.inArray(files[i].type.toLowerCase(), types) === -1))    // Check file type
                  {
                      return false;
                  }
              }

              if ((options.maxTotalSize && totalSize > parseInt(options.maxTotalSize, 10))        // Check the maxTotalSize
                  || (options.minTotalSize && totalSize < parseInt(options.minTotalSize, 10)))    // Check the minTotalSize
              {
                  return false;
              }
          } else {
              // Check file extension
              ext = value.substr(value.lastIndexOf('.') + 1);
              if (extensions && $.inArray(ext.toLowerCase(), extensions) === -1) {
                  return false;
              }
          }

          return true;
      }
  };
}(window.jQuery));
;(function($) {
  $.fn.bootstrapValidator.i18n.greaterThan = $.extend($.fn.bootstrapValidator.i18n.greaterThan || {}, {
      'default': 'Please enter a value greater than or equal to %s',
      notInclusive: 'Please enter a value greater than %s'
  });

  $.fn.bootstrapValidator.validators.greaterThan = {
      html5Attributes: {
          message: 'message',
          value: 'value',
          inclusive: 'inclusive'
      },

      enableByHtml5: function($field) {
          var type = $field.attr('type'),
              min  = $field.attr('min');
          if (min && type !== 'date') {
              return {
                  value: min
              };
          }

          return false;
      },

      /**
       * Return true if the input value is greater than or equals to given number
       *
       * @param {BootstrapValidator} validator Validate plugin instance
       * @param {jQuery} $field Field element
       * @param {Object} options Can consist of the following keys:
       * - value: Define the number to compare with. It can be
       *      - A number
       *      - Name of field which its value defines the number
       *      - Name of callback function that returns the number
       *      - A callback function that returns the number
       *
       * - inclusive [optional]: Can be true or false. Default is true
       * - message: The invalid message
       * @returns {Boolean|Object}
       */
      validate: function(validator, $field, options) {
          var value = $field.val();
          if (value === '') {
              return true;
          }
          
          value = this._format(value);
          if (!$.isNumeric(value)) {
              return false;
          }

          var compareTo      = $.isNumeric(options.value) ? options.value : validator.getDynamicOption($field, options.value),
              compareToValue = this._format(compareTo);

          value = parseFloat(value);
    return (options.inclusive === true || options.inclusive === undefined)
                  ? {
                      valid: value >= compareToValue,
                      message: $.fn.bootstrapValidator.helpers.format(options.message || $.fn.bootstrapValidator.i18n.greaterThan['default'], compareTo)
                  }
                  : {
                      valid: value > compareToValue,
                      message: $.fn.bootstrapValidator.helpers.format(options.message || $.fn.bootstrapValidator.i18n.greaterThan.notInclusive, compareTo)
                  };
      },

      _format: function(value) {
          return (value + '').replace(',', '.');
      }
  };
}(window.jQuery));
;(function($) {
  $.fn.bootstrapValidator.i18n.grid = $.extend($.fn.bootstrapValidator.i18n.grid || {}, {
      'default': 'Please enter a valid GRId number'
  });

  $.fn.bootstrapValidator.validators.grid = {
      /**
       * Validate GRId (Global Release Identifier)
       * Examples:
       * - Valid: A12425GABC1234002M, A1-2425G-ABC1234002-M, A1 2425G ABC1234002 M, Grid:A1-2425G-ABC1234002-M
       * - Invalid: A1-2425G-ABC1234002-Q
       *
       * @see http://en.wikipedia.org/wiki/Global_Release_Identifier
       * @param {BootstrapValidator} validator The validator plugin instance
       * @param {jQuery} $field Field element
       * @param {Object} options Can consist of the following keys:
       * - message: The invalid message
       * @returns {Boolean}
       */
      validate: function(validator, $field, options) {
          var value = $field.val();
          if (value === '') {
              return true;
          }

          value = value.toUpperCase();
          if (!/^[GRID:]*([0-9A-Z]{2})[-\s]*([0-9A-Z]{5})[-\s]*([0-9A-Z]{10})[-\s]*([0-9A-Z]{1})$/g.test(value)) {
              return false;
          }
          value = value.replace(/\s/g, '').replace(/-/g, '');
          if ('GRID:' === value.substr(0, 5)) {
              value = value.substr(5);
          }
          return $.fn.bootstrapValidator.helpers.mod37And36(value);
      }
  };
}(window.jQuery));
;(function($) {
  $.fn.bootstrapValidator.i18n.hex = $.extend($.fn.bootstrapValidator.i18n.hex || {}, {
      'default': 'Please enter a valid hexadecimal number'
  });

  $.fn.bootstrapValidator.validators.hex = {
      /**
       * Return true if and only if the input value is a valid hexadecimal number
       *
       * @param {BootstrapValidator} validator The validator plugin instance
       * @param {jQuery} $field Field element
       * @param {Object} options Consist of key:
       * - message: The invalid message
       * @returns {Boolean}
       */
      validate: function(validator, $field, options) {
          var value = $field.val();
          if (value === '') {
              return true;
          }

          return /^[0-9a-fA-F]+$/.test(value);
      }
  };
}(window.jQuery));
;(function($) {
  $.fn.bootstrapValidator.i18n.hexColor = $.extend($.fn.bootstrapValidator.i18n.hexColor || {}, {
      'default': 'Please enter a valid hex color'
  });

  $.fn.bootstrapValidator.validators.hexColor = {
      enableByHtml5: function($field) {
          return ('color' === $field.attr('type'));
      },

      /**
       * Return true if the input value is a valid hex color
       *
       * @param {BootstrapValidator} validator The validator plugin instance
       * @param {jQuery} $field Field element
       * @param {Object} options Can consist of the following keys:
       * - message: The invalid message
       * @returns {Boolean}
       */
      validate: function(validator, $field, options) {
          var value = $field.val();
          if (value === '') {
              return true;
          }

          return ('color' === $field.attr('type'))
                      // Only accept 6 hex character values due to the HTML 5 spec
                      // See http://www.w3.org/TR/html-markup/input.color.html#input.color.attrs.value
                      ? /^#[0-9A-F]{6}$/i.test(value)
                      : /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(value);
      }
  };
}(window.jQuery));
;(function($) {
  $.fn.bootstrapValidator.i18n.iban = $.extend($.fn.bootstrapValidator.i18n.iban || {}, {
      'default': 'Please enter a valid IBAN number',
      countryNotSupported: 'The country code %s is not supported',
      country: 'Please enter a valid IBAN number in %s',
      countries: {
          AD: 'Andorra',
          AE: 'United Arab Emirates',
          AL: 'Albania',
          AO: 'Angola',
          AT: 'Austria',
          AZ: 'Azerbaijan',
          BA: 'Bosnia and Herzegovina',
          BE: 'Belgium',
          BF: 'Burkina Faso',
          BG: 'Bulgaria',
          BH: 'Bahrain',
          BI: 'Burundi',
          BJ: 'Benin',
          BR: 'Brazil',
          CH: 'Switzerland',
          CI: 'Ivory Coast',
          CM: 'Cameroon',
          CR: 'Costa Rica',
          CV: 'Cape Verde',
          CY: 'Cyprus',
          CZ: 'Czech Republic',
          DE: 'Germany',
          DK: 'Denmark',
          DO: 'Dominican Republic',
          DZ: 'Algeria',
          EE: 'Estonia',
          ES: 'Spain',
          FI: 'Finland',
          FO: 'Faroe Islands',
          FR: 'France',
          GB: 'United Kingdom',
          GE: 'Georgia',
          GI: 'Gibraltar',
          GL: 'Greenland',
          GR: 'Greece',
          GT: 'Guatemala',
          HR: 'Croatia',
          HU: 'Hungary',
          IE: 'Ireland',
          IL: 'Israel',
          IR: 'Iran',
          IS: 'Iceland',
          IT: 'Italy',
          JO: 'Jordan',
          KW: 'Kuwait',
          KZ: 'Kazakhstan',
          LB: 'Lebanon',
          LI: 'Liechtenstein',
          LT: 'Lithuania',
          LU: 'Luxembourg',
          LV: 'Latvia',
          MC: 'Monaco',
          MD: 'Moldova',
          ME: 'Montenegro',
          MG: 'Madagascar',
          MK: 'Macedonia',
          ML: 'Mali',
          MR: 'Mauritania',
          MT: 'Malta',
          MU: 'Mauritius',
          MZ: 'Mozambique',
          NL: 'Netherlands',
          NO: 'Norway',
          PK: 'Pakistan',
          PL: 'Poland',
          PS: 'Palestine',
          PT: 'Portugal',
          QA: 'Qatar',
          RO: 'Romania',
          RS: 'Serbia',
          SA: 'Saudi Arabia',
          SE: 'Sweden',
          SI: 'Slovenia',
          SK: 'Slovakia',
          SM: 'San Marino',
          SN: 'Senegal',
          TN: 'Tunisia',
          TR: 'Turkey',
          VG: 'Virgin Islands, British'
      }
  });

  $.fn.bootstrapValidator.validators.iban = {
      html5Attributes: {
          message: 'message',
          country: 'country'
      },

      // http://www.swift.com/dsp/resources/documents/IBAN_Registry.pdf
      // http://en.wikipedia.org/wiki/International_Bank_Account_Number#IBAN_formats_by_country
      REGEX: {
          AD: 'AD[0-9]{2}[0-9]{4}[0-9]{4}[A-Z0-9]{12}',                       // Andorra
          AE: 'AE[0-9]{2}[0-9]{3}[0-9]{16}',                                  // United Arab Emirates
          AL: 'AL[0-9]{2}[0-9]{8}[A-Z0-9]{16}',                               // Albania
          AO: 'AO[0-9]{2}[0-9]{21}',                                          // Angola
          AT: 'AT[0-9]{2}[0-9]{5}[0-9]{11}',                                  // Austria
          AZ: 'AZ[0-9]{2}[A-Z]{4}[A-Z0-9]{20}',                               // Azerbaijan
          BA: 'BA[0-9]{2}[0-9]{3}[0-9]{3}[0-9]{8}[0-9]{2}',                   // Bosnia and Herzegovina
          BE: 'BE[0-9]{2}[0-9]{3}[0-9]{7}[0-9]{2}',                           // Belgium
          BF: 'BF[0-9]{2}[0-9]{23}',                                          // Burkina Faso
          BG: 'BG[0-9]{2}[A-Z]{4}[0-9]{4}[0-9]{2}[A-Z0-9]{8}',                // Bulgaria
          BH: 'BH[0-9]{2}[A-Z]{4}[A-Z0-9]{14}',                               // Bahrain
          BI: 'BI[0-9]{2}[0-9]{12}',                                          // Burundi
          BJ: 'BJ[0-9]{2}[A-Z]{1}[0-9]{23}',                                  // Benin
          BR: 'BR[0-9]{2}[0-9]{8}[0-9]{5}[0-9]{10}[A-Z][A-Z0-9]',             // Brazil
          CH: 'CH[0-9]{2}[0-9]{5}[A-Z0-9]{12}',                               // Switzerland
          CI: 'CI[0-9]{2}[A-Z]{1}[0-9]{23}',                                  // Ivory Coast
          CM: 'CM[0-9]{2}[0-9]{23}',                                          // Cameroon
          CR: 'CR[0-9]{2}[0-9]{3}[0-9]{14}',                                  // Costa Rica
          CV: 'CV[0-9]{2}[0-9]{21}',                                          // Cape Verde
          CY: 'CY[0-9]{2}[0-9]{3}[0-9]{5}[A-Z0-9]{16}',                       // Cyprus
          CZ: 'CZ[0-9]{2}[0-9]{20}',                                          // Czech Republic
          DE: 'DE[0-9]{2}[0-9]{8}[0-9]{10}',                                  // Germany
          DK: 'DK[0-9]{2}[0-9]{14}',                                          // Denmark
          DO: 'DO[0-9]{2}[A-Z0-9]{4}[0-9]{20}',                               // Dominican Republic
          DZ: 'DZ[0-9]{2}[0-9]{20}',                                          // Algeria
          EE: 'EE[0-9]{2}[0-9]{2}[0-9]{2}[0-9]{11}[0-9]{1}',                  // Estonia
          ES: 'ES[0-9]{2}[0-9]{4}[0-9]{4}[0-9]{1}[0-9]{1}[0-9]{10}',          // Spain
          FI: 'FI[0-9]{2}[0-9]{6}[0-9]{7}[0-9]{1}',                           // Finland
          FO: 'FO[0-9]{2}[0-9]{4}[0-9]{9}[0-9]{1}',                           // Faroe Islands
          FR: 'FR[0-9]{2}[0-9]{5}[0-9]{5}[A-Z0-9]{11}[0-9]{2}',               // France
          GB: 'GB[0-9]{2}[A-Z]{4}[0-9]{6}[0-9]{8}',                           // United Kingdom
          GE: 'GE[0-9]{2}[A-Z]{2}[0-9]{16}',                                  // Georgia
          GI: 'GI[0-9]{2}[A-Z]{4}[A-Z0-9]{15}',                               // Gibraltar
          GL: 'GL[0-9]{2}[0-9]{4}[0-9]{9}[0-9]{1}',                           // Greenland
          GR: 'GR[0-9]{2}[0-9]{3}[0-9]{4}[A-Z0-9]{16}',                       // Greece
          GT: 'GT[0-9]{2}[A-Z0-9]{4}[A-Z0-9]{20}',                            // Guatemala
          HR: 'HR[0-9]{2}[0-9]{7}[0-9]{10}',                                  // Croatia
          HU: 'HU[0-9]{2}[0-9]{3}[0-9]{4}[0-9]{1}[0-9]{15}[0-9]{1}',          // Hungary
          IE: 'IE[0-9]{2}[A-Z]{4}[0-9]{6}[0-9]{8}',                           // Ireland
          IL: 'IL[0-9]{2}[0-9]{3}[0-9]{3}[0-9]{13}',                          // Israel
          IR: 'IR[0-9]{2}[0-9]{22}',                                          // Iran
          IS: 'IS[0-9]{2}[0-9]{4}[0-9]{2}[0-9]{6}[0-9]{10}',                  // Iceland
          IT: 'IT[0-9]{2}[A-Z]{1}[0-9]{5}[0-9]{5}[A-Z0-9]{12}',               // Italy
          JO: 'JO[0-9]{2}[A-Z]{4}[0-9]{4}[0]{8}[A-Z0-9]{10}',                 // Jordan
          KW: 'KW[0-9]{2}[A-Z]{4}[0-9]{22}',                                  // Kuwait
          KZ: 'KZ[0-9]{2}[0-9]{3}[A-Z0-9]{13}',                               // Kazakhstan
          LB: 'LB[0-9]{2}[0-9]{4}[A-Z0-9]{20}',                               // Lebanon
          LI: 'LI[0-9]{2}[0-9]{5}[A-Z0-9]{12}',                               // Liechtenstein
          LT: 'LT[0-9]{2}[0-9]{5}[0-9]{11}',                                  // Lithuania
          LU: 'LU[0-9]{2}[0-9]{3}[A-Z0-9]{13}',                               // Luxembourg
          LV: 'LV[0-9]{2}[A-Z]{4}[A-Z0-9]{13}',                               // Latvia
          MC: 'MC[0-9]{2}[0-9]{5}[0-9]{5}[A-Z0-9]{11}[0-9]{2}',               // Monaco
          MD: 'MD[0-9]{2}[A-Z0-9]{20}',                                       // Moldova
          ME: 'ME[0-9]{2}[0-9]{3}[0-9]{13}[0-9]{2}',                          // Montenegro
          MG: 'MG[0-9]{2}[0-9]{23}',                                          // Madagascar
          MK: 'MK[0-9]{2}[0-9]{3}[A-Z0-9]{10}[0-9]{2}',                       // Macedonia
          ML: 'ML[0-9]{2}[A-Z]{1}[0-9]{23}',                                  // Mali
          MR: 'MR13[0-9]{5}[0-9]{5}[0-9]{11}[0-9]{2}',                        // Mauritania
          MT: 'MT[0-9]{2}[A-Z]{4}[0-9]{5}[A-Z0-9]{18}',                       // Malta
          MU: 'MU[0-9]{2}[A-Z]{4}[0-9]{2}[0-9]{2}[0-9]{12}[0-9]{3}[A-Z]{3}',  // Mauritius
          MZ: 'MZ[0-9]{2}[0-9]{21}',                                          // Mozambique
          NL: 'NL[0-9]{2}[A-Z]{4}[0-9]{10}',                                  // Netherlands
          NO: 'NO[0-9]{2}[0-9]{4}[0-9]{6}[0-9]{1}',                           // Norway
          PK: 'PK[0-9]{2}[A-Z]{4}[A-Z0-9]{16}',                               // Pakistan
          PL: 'PL[0-9]{2}[0-9]{8}[0-9]{16}',                                  // Poland
          PS: 'PS[0-9]{2}[A-Z]{4}[A-Z0-9]{21}',                               // Palestinian
          PT: 'PT[0-9]{2}[0-9]{4}[0-9]{4}[0-9]{11}[0-9]{2}',                  // Portugal
          QA: 'QA[0-9]{2}[A-Z]{4}[A-Z0-9]{21}',                               // Qatar
          RO: 'RO[0-9]{2}[A-Z]{4}[A-Z0-9]{16}',                               // Romania
          RS: 'RS[0-9]{2}[0-9]{3}[0-9]{13}[0-9]{2}',                          // Serbia
          SA: 'SA[0-9]{2}[0-9]{2}[A-Z0-9]{18}',                               // Saudi Arabia
          SE: 'SE[0-9]{2}[0-9]{3}[0-9]{16}[0-9]{1}',                          // Sweden
          SI: 'SI[0-9]{2}[0-9]{5}[0-9]{8}[0-9]{2}',                           // Slovenia
          SK: 'SK[0-9]{2}[0-9]{4}[0-9]{6}[0-9]{10}',                          // Slovakia
          SM: 'SM[0-9]{2}[A-Z]{1}[0-9]{5}[0-9]{5}[A-Z0-9]{12}',               // San Marino
          SN: 'SN[0-9]{2}[A-Z]{1}[0-9]{23}',                                  // Senegal
          TN: 'TN59[0-9]{2}[0-9]{3}[0-9]{13}[0-9]{2}',                        // Tunisia
          TR: 'TR[0-9]{2}[0-9]{5}[A-Z0-9]{1}[A-Z0-9]{16}',                    // Turkey
          VG: 'VG[0-9]{2}[A-Z]{4}[0-9]{16}'                                   // Virgin Islands, British
      },

      /**
       * Validate an International Bank Account Number (IBAN)
       * To test it, take the sample IBAN from
       * http://www.nordea.com/Our+services/International+products+and+services/Cash+Management/IBAN+countries/908462.html
       *
       * @param {BootstrapValidator} validator The validator plugin instance
       * @param {jQuery} $field Field element
       * @param {Object} options Can consist of the following keys:
       * - message: The invalid message
       * - country: The ISO 3166-1 country code. It can be
       *      - A country code
       *      - Name of field which its value defines the country code
       *      - Name of callback function that returns the country code
       *      - A callback function that returns the country code
       * @returns {Boolean|Object}
       */
      validate: function(validator, $field, options) {
          var value = $field.val();
          if (value === '') {
              return true;
          }

          value = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          var country = options.country;
          if (!country) {
              country = value.substr(0, 2);
          } else if (typeof country !== 'string' || !this.REGEX[country]) {
              // Determine the country code
              country = validator.getDynamicOption($field, country);
          }

          if (!this.REGEX[country]) {
              return {
                  valid: false,
                  message: $.fn.bootstrapValidator.helpers.format($.fn.bootstrapValidator.i18n.iban.countryNotSupported, country)
              };
          }

          if (!(new RegExp('^' + this.REGEX[country] + '$')).test(value)) {
              return {
                  valid: false,
                  message: $.fn.bootstrapValidator.helpers.format(options.message || $.fn.bootstrapValidator.i18n.iban.country, $.fn.bootstrapValidator.i18n.iban.countries[country])
              };
          }

          value = value.substr(4) + value.substr(0, 4);
          value = $.map(value.split(''), function(n) {
              var code = n.charCodeAt(0);
              return (code >= 'A'.charCodeAt(0) && code <= 'Z'.charCodeAt(0))
                      // Replace A, B, C, ..., Z with 10, 11, ..., 35
                      ? (code - 'A'.charCodeAt(0) + 10)
                      : n;
          });
          value = value.join('');

          var temp   = parseInt(value.substr(0, 1), 10),
              length = value.length;
          for (var i = 1; i < length; ++i) {
              temp = (temp * 10 + parseInt(value.substr(i, 1), 10)) % 97;
          }

          return {
              valid: (temp === 1),
              message: $.fn.bootstrapValidator.helpers.format(options.message || $.fn.bootstrapValidator.i18n.iban.country, $.fn.bootstrapValidator.i18n.iban.countries[country])
          };
      }
  };
}(window.jQuery));
;(function($) {
  $.fn.bootstrapValidator.i18n.id = $.extend($.fn.bootstrapValidator.i18n.id || {}, {
      'default': 'Please enter a valid identification number',
      countryNotSupported: 'The country code %s is not supported',
      country: 'Please enter a valid identification number in %s',
      countries: {
          BA: 'Bosnia and Herzegovina',
          BG: 'Bulgaria',
          BR: 'Brazil',
          CH: 'Switzerland',
          CL: 'Chile',
          CN: 'China',
          CZ: 'Czech Republic',
          DK: 'Denmark',
          EE: 'Estonia',
          ES: 'Spain',
          FI: 'Finland',
          HR: 'Croatia',
          IE: 'Ireland',
          IS: 'Iceland',
          LT: 'Lithuania',
          LV: 'Latvia',
          ME: 'Montenegro',
          MK: 'Macedonia',
          NL: 'Netherlands',
          RO: 'Romania',
          RS: 'Serbia',
          SE: 'Sweden',
          SI: 'Slovenia',
          SK: 'Slovakia',
          SM: 'San Marino',
          TH: 'Thailand',
          ZA: 'South Africa'
      }
  });

  $.fn.bootstrapValidator.validators.id = {
      html5Attributes: {
          message: 'message',
          country: 'country'
      },

      // Supported country codes
      COUNTRY_CODES: [
          'BA', 'BG', 'BR', 'CH', 'CL', 'CN', 'CZ', 'DK', 'EE', 'ES', 'FI', 'HR', 'IE', 'IS', 'LT', 'LV', 'ME', 'MK', 'NL',
          'RO', 'RS', 'SE', 'SI', 'SK', 'SM', 'TH', 'ZA'
      ],

      /**
       * Validate identification number in different countries
       *
       * @see http://en.wikipedia.org/wiki/National_identification_number
       * @param {BootstrapValidator} validator The validator plugin instance
       * @param {jQuery} $field Field element
       * @param {Object} options Consist of key:
       * - message: The invalid message
       * - country: The ISO 3166-1 country code. It can be
       *      - One of country code defined in COUNTRY_CODES
       *      - Name of field which its value defines the country code
       *      - Name of callback function that returns the country code
       *      - A callback function that returns the country code
       * @returns {Boolean|Object}
       */
      validate: function(validator, $field, options) {
          var value = $field.val();
          if (value === '') {
              return true;
          }

          var country = options.country;
          if (!country) {
              country = value.substr(0, 2);
          } else if (typeof country !== 'string' || $.inArray(country.toUpperCase(), this.COUNTRY_CODES) === -1) {
              // Determine the country code
              country = validator.getDynamicOption($field, country);
          }

          if ($.inArray(country, this.COUNTRY_CODES) === -1) {
              return { valid: false, message: $.fn.bootstrapValidator.helpers.format($.fn.bootstrapValidator.i18n.id.countryNotSupported, country) };
          }

          var method  = ['_', country.toLowerCase()].join('');
          return this[method](value)
                  ? true
                  : {
                      valid: false,
                      message: $.fn.bootstrapValidator.helpers.format(options.message || $.fn.bootstrapValidator.i18n.id.country, $.fn.bootstrapValidator.i18n.id.countries[country.toUpperCase()])
                  };
      },

      /**
       * Validate Unique Master Citizen Number which uses in
       * - Bosnia and Herzegovina (country code: BA)
       * - Macedonia (MK)
       * - Montenegro (ME)
       * - Serbia (RS)
       * - Slovenia (SI)
       *
       * @see http://en.wikipedia.org/wiki/Unique_Master_Citizen_Number
       * @param {String} value The ID
       * @param {String} countryCode The ISO country code, can be BA, MK, ME, RS, SI
       * @returns {Boolean}
       */
      _validateJMBG: function(value, countryCode) {
          if (!/^\d{13}$/.test(value)) {
              return false;
          }
          var day   = parseInt(value.substr(0, 2), 10),
              month = parseInt(value.substr(2, 2), 10),
              year  = parseInt(value.substr(4, 3), 10),
              rr    = parseInt(value.substr(7, 2), 10),
              k     = parseInt(value.substr(12, 1), 10);

          // Validate date of birth
          // FIXME: Validate the year of birth
          if (day > 31 || month > 12) {
              return false;
          }

          // Validate checksum
          var sum = 0;
          for (var i = 0; i < 6; i++) {
              sum += (7 - i) * (parseInt(value.charAt(i), 10) + parseInt(value.charAt(i + 6), 10));
          }
          sum = 11 - sum % 11;
          if (sum === 10 || sum === 11) {
              sum = 0;
          }
          if (sum !== k) {
              return false;
          }

          // Validate political region
          // rr is the political region of birth, which can be in ranges:
          // 10-19: Bosnia and Herzegovina
          // 20-29: Montenegro
          // 30-39: Croatia (not used anymore)
          // 41-49: Macedonia
          // 50-59: Slovenia (only 50 is used)
          // 70-79: Central Serbia
          // 80-89: Serbian province of Vojvodina
          // 90-99: Kosovo
          switch (countryCode.toUpperCase()) {
              case 'BA':
                  return (10 <= rr && rr <= 19);
              case 'MK':
                  return (41 <= rr && rr <= 49);
              case 'ME':
                  return (20 <= rr && rr <= 29);
              case 'RS':
                  return (70 <= rr && rr <= 99);
              case 'SI':
                  return (50 <= rr && rr <= 59);
              default:
                  return true;
          }
      },

      _ba: function(value) {
          return this._validateJMBG(value, 'BA');
      },
      _mk: function(value) {
          return this._validateJMBG(value, 'MK');
      },
      _me: function(value) {
          return this._validateJMBG(value, 'ME');
      },
      _rs: function(value) {
          return this._validateJMBG(value, 'RS');
      },

      /**
       * Examples: 0101006500006
       */
      _si: function(value) {
          return this._validateJMBG(value, 'SI');
      },

      /**
       * Validate Bulgarian national identification number (EGN)
       * Examples:
       * - Valid: 7523169263, 8032056031, 803205 603 1, 8001010008, 7501020018, 7552010005, 7542011030
       * - Invalid: 8019010008
       *
       * @see http://en.wikipedia.org/wiki/Uniform_civil_number
       * @param {String} value The ID
       * @returns {Boolean}
       */
      _bg: function(value) {
          if (!/^\d{10}$/.test(value) && !/^\d{6}\s\d{3}\s\d{1}$/.test(value)) {
              return false;
          }
          value = value.replace(/\s/g, '');
          // Check the birth date
          var year  = parseInt(value.substr(0, 2), 10) + 1900,
              month = parseInt(value.substr(2, 2), 10),
              day   = parseInt(value.substr(4, 2), 10);
          if (month > 40) {
              year += 100;
              month -= 40;
          } else if (month > 20) {
              year -= 100;
              month -= 20;
          }

          if (!$.fn.bootstrapValidator.helpers.date(year, month, day)) {
              return false;
          }

          var sum    = 0,
              weight = [2, 4, 8, 5, 10, 9, 7, 3, 6];
          for (var i = 0; i < 9; i++) {
              sum += parseInt(value.charAt(i), 10) * weight[i];
          }
          sum = (sum % 11) % 10;
          return (sum + '' === value.substr(9, 1));
      },

      /**
       * Validate Brazilian national identification number (CPF)
       * Examples:
       * - Valid: 39053344705, 390.533.447-05, 111.444.777-35
       * - Invalid: 231.002.999-00
       *
       * @see http://en.wikipedia.org/wiki/Cadastro_de_Pessoas_F%C3%ADsicas
       * @param {String} value The ID
       * @returns {Boolean}
       */
      _br: function(value) {
          if (/^1{11}|2{11}|3{11}|4{11}|5{11}|6{11}|7{11}|8{11}|9{11}|0{11}$/.test(value)) {
              return false;
          }
          if (!/^\d{11}$/.test(value) && !/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(value)) {
              return false;
          }
          value = value.replace(/\./g, '').replace(/-/g, '');

          var d1 = 0;
          for (var i = 0; i < 9; i++) {
              d1 += (10 - i) * parseInt(value.charAt(i), 10);
          }
          d1 = 11 - d1 % 11;
          if (d1 === 10 || d1 === 11) {
              d1 = 0;
          }
          if (d1 + '' !== value.charAt(9)) {
              return false;
          }

          var d2 = 0;
          for (i = 0; i < 10; i++) {
              d2 += (11 - i) * parseInt(value.charAt(i), 10);
          }
          d2 = 11 - d2 % 11;
          if (d2 === 10 || d2 === 11) {
              d2 = 0;
          }

          return (d2 + '' === value.charAt(10));
      },

      /**
       * Validate Swiss Social Security Number (AHV-Nr/No AVS)
       * Examples:
       * - Valid: 756.1234.5678.95, 7561234567895
       *
       * @see http://en.wikipedia.org/wiki/National_identification_number#Switzerland
       * @see http://www.bsv.admin.ch/themen/ahv/00011/02185/index.html?lang=de
       * @param {String} value The ID
       * @returns {Boolean}
       */
      _ch: function(value) {
          if (!/^756[\.]{0,1}[0-9]{4}[\.]{0,1}[0-9]{4}[\.]{0,1}[0-9]{2}$/.test(value)) {
              return false;
          }
          value = value.replace(/\D/g, '').substr(3);
          var length = value.length,
              sum    = 0,
              weight = (length === 8) ? [3, 1] : [1, 3];
          for (var i = 0; i < length - 1; i++) {
              sum += parseInt(value.charAt(i), 10) * weight[i % 2];
          }
          sum = 10 - sum % 10;
          return (sum + '' === value.charAt(length - 1));
      },

      /**
       * Validate Chilean national identification number (RUN/RUT)
       * Examples:
       * - Valid: 76086428-5, 22060449-7, 12531909-2
       *
       * @see http://en.wikipedia.org/wiki/National_identification_number#Chile
       * @see https://palena.sii.cl/cvc/dte/ee_empresas_emisoras.html for samples
       * @param {String} value The ID
       * @returns {Boolean}
       */
      _cl: function(value) {
          if (!/^\d{7,8}[-]{0,1}[0-9K]$/i.test(value)) {
              return false;
          }
          value = value.replace(/\-/g, '');
          while (value.length < 9) {
              value = '0' + value;
          }
          var sum    = 0,
              weight = [3, 2, 7, 6, 5, 4, 3, 2];
          for (var i = 0; i < 8; i++) {
              sum += parseInt(value.charAt(i), 10) * weight[i];
          }
          sum = 11 - sum % 11;
          if (sum === 11) {
              sum = 0;
          } else if (sum === 10) {
              sum = 'K';
          }
          return sum + '' === value.charAt(8).toUpperCase();
      },

      /**
       * Validate Chinese citizen identification number
       *
       * Rules:
       * - For current 18-digit system (since 1st Oct 1999, defined by GB11643—1999 national standard):
       *     - Digit 0-5: Must be a valid administrative division code of China PR.
       *     - Digit 6-13: Must be a valid YYYYMMDD date of birth. A future date is tolerated.
       *     - Digit 14-16: Order code, any integer.
       *     - Digit 17: An ISO 7064:1983, MOD 11-2 checksum.
       *       Both upper/lower case of X are tolerated.
       * - For deprecated 15-digit system:
       *     - Digit 0-5: Must be a valid administrative division code of China PR.
       *     - Digit 6-11: Must be a valid YYMMDD date of birth, indicating the year of 19XX.
       *     - Digit 12-14: Order code, any integer.
       * Lists of valid administrative division codes of China PR can be seen here:
       * <http://www.stats.gov.cn/tjsj/tjbz/xzqhdm/>
       * Published and maintained by National Bureau of Statistics of China PR.
       * NOTE: Current and deprecated codes MUST BOTH be considered valid.
       * Many Chinese citizens born in once existed administrative divisions!
       *
       * @see http://en.wikipedia.org/wiki/Resident_Identity_Card#Identity_card_number
       * @param {String} value The ID
       * @returns {Boolean}
       */
      _cn: function(value) {
          // Basic format check (18 or 15 digits, considering X in checksum)
          value = value.trim();
          if (!/^\d{15}$/.test(value) && !/^\d{17}[\dXx]{1}$/.test(value)) {
              return false;
          }
          
          // Check China PR Administrative division code
          var adminDivisionCodes = {
              11: {
                  0: [0],
                  1: [[0, 9], [11, 17]],
                  2: [0, 28, 29]
              },
              12: {
                  0: [0],
                  1: [[0, 16]],
                  2: [0, 21, 23, 25]
              },
              13: {
                  0: [0],
                  1: [[0, 5], 7, 8, 21, [23, 33], [81, 85]],
                  2: [[0, 5], [7, 9], [23, 25], 27, 29, 30, 81, 83],
                  3: [[0, 4], [21, 24]],
                  4: [[0, 4], 6, 21, [23, 35], 81],
                  5: [[0, 3], [21, 35], 81, 82],
                  6: [[0, 4], [21, 38], [81, 84]],
                  7: [[0, 3], 5, 6, [21, 33]],
                  8: [[0, 4], [21, 28]],
                  9: [[0, 3], [21, 30], [81, 84]],
                  10: [[0, 3], [22, 26], 28, 81, 82],
                  11: [[0, 2], [21, 28], 81, 82]
              },
              14: {
                  0: [0],
                  1: [0, 1, [5, 10], [21, 23], 81],
                  2: [[0, 3], 11, 12, [21, 27]],
                  3: [[0, 3], 11, 21, 22],
                  4: [[0, 2], 11, 21, [23, 31], 81],
                  5: [[0, 2], 21, 22, 24, 25, 81],
                  6: [[0, 3], [21, 24]],
                  7: [[0, 2], [21, 29], 81],
                  8: [[0, 2], [21, 30], 81, 82],
                  9: [[0, 2], [21, 32], 81],
                  10: [[0, 2], [21, 34], 81, 82],
                  11: [[0, 2], [21, 30], 81, 82],
                  23: [[0, 3], 22, 23, [25, 30], 32, 33]
              },
              15: {
                  0: [0],
                  1: [[0, 5], [21, 25]],
                  2: [[0, 7], [21, 23]],
                  3: [[0, 4]],
                  4: [[0, 4], [21, 26], [28, 30]],
                  5: [[0, 2], [21, 26], 81],
                  6: [[0, 2], [21, 27]],
                  7: [[0, 3], [21, 27], [81, 85]],
                  8: [[0, 2], [21, 26]],
                  9: [[0, 2], [21, 29], 81],
                  22: [[0, 2], [21, 24]],
                  25: [[0, 2], [22, 31]],
                  26: [[0, 2], [24, 27], [29, 32], 34],
                  28: [0, 1, [22, 27]],
                  29: [0, [21, 23]]
              },
              21: {
                  0: [0],
                  1: [[0, 6], [11, 14], [22, 24], 81],
                  2: [[0, 4], [11, 13], 24, [81, 83]],
                  3: [[0, 4], 11, 21, 23, 81],
                  4: [[0, 4], 11, [21, 23]],
                  5: [[0, 5], 21, 22],
                  6: [[0, 4], 24, 81, 82],
                  7: [[0, 3], 11, 26, 27, 81, 82],
                  8: [[0, 4], 11, 81, 82],
                  9: [[0, 5], 11, 21, 22],
                  10: [[0, 5], 11, 21, 81],
                  11: [[0, 3], 21, 22],
                  12: [[0, 2], 4, 21, 23, 24, 81, 82],
                  13: [[0, 3], 21, 22, 24, 81, 82],
                  14: [[0, 4], 21, 22, 81]
              },
              22: {
                  0: [0],
                  1: [[0, 6], 12, 22, [81, 83]],
                  2: [[0, 4], 11, 21, [81, 84]],
                  3: [[0, 3], 22, 23, 81, 82],
                  4: [[0, 3], 21, 22],
                  5: [[0, 3], 21, 23, 24, 81, 82],
                  6: [[0, 2], 4, 5, [21, 23], 25, 81],
                  7: [[0, 2], [21, 24], 81],
                  8: [[0, 2], 21, 22, 81, 82],
                  24: [[0, 6], 24, 26]
              },
              23: {
                  0: [0],
                  1: [[0, 12], 21, [23, 29], [81, 84]],
                  2: [[0, 8], 21, [23, 25], 27, [29, 31], 81],
                  3: [[0, 7], 21, 81, 82],
                  4: [[0, 7], 21, 22],
                  5: [[0, 3], 5, 6, [21, 24]],
                  6: [[0, 6], [21, 24]],
                  7: [[0, 16], 22, 81],
                  8: [[0, 5], 11, 22, 26, 28, 33, 81, 82],
                  9: [[0, 4], 21],
                  10: [[0, 5], 24, 25, 81, [83, 85]],
                  11: [[0, 2], 21, 23, 24, 81, 82],
                  12: [[0, 2], [21, 26], [81, 83]],
                  27: [[0, 4], [21, 23]]
              },
              31: {
                  0: [0],
                  1: [0, 1, [3, 10], [12, 20]],
                  2: [0, 30]
              },
              32: {
                  0: [0],
                  1: [[0, 7], 11, [13, 18], 24, 25],
                  2: [[0, 6], 11, 81, 82],
                  3: [[0, 5], 11, 12, [21, 24], 81, 82],
                  4: [[0, 2], 4, 5, 11, 12, 81, 82],
                  5: [[0, 9], [81, 85]],
                  6: [[0, 2], 11, 12, 21, 23, [81, 84]],
                  7: [0, 1, 3, 5, 6, [21, 24]],
                  8: [[0, 4], 11, 26, [29, 31]],
                  9: [[0, 3], [21, 25], 28, 81, 82],
                  10: [[0, 3], 11, 12, 23, 81, 84, 88],
                  11: [[0, 2], 11, 12, [81, 83]],
                  12: [[0, 4], [81, 84]],
                  13: [[0, 2], 11, [21, 24]]
              },
              33: {
                  0: [0],
                  1: [[0, 6], [8, 10], 22, 27, 82, 83, 85],
                  2: [0, 1, [3, 6], 11, 12, 25, 26, [81, 83]],
                  3: [[0, 4], 22, 24, [26, 29], 81, 82],
                  4: [[0, 2], 11, 21, 24, [81, 83]],
                  5: [[0, 3], [21, 23]],
                  6: [[0, 2], 21, 24, [81, 83]],
                  7: [[0, 3], 23, 26, 27, [81, 84]],
                  8: [[0, 3], 22, 24, 25, 81],
                  9: [[0, 3], 21, 22],
                  10: [[0, 4], [21, 24], 81, 82],
                  11: [[0, 2], [21, 27], 81]
              },
              34: {
                  0: [0],
                  1: [[0, 4], 11, [21, 24], 81],
                  2: [[0, 4], 7, 8, [21, 23], 25],
                  3: [[0, 4], 11, [21, 23]],
                  4: [[0, 6], 21],
                  5: [[0, 4], 6, [21, 23]],
                  6: [[0, 4], 21],
                  7: [[0, 3], 11, 21],
                  8: [[0, 3], 11, [22, 28], 81],
                  10: [[0, 4], [21, 24]],
                  11: [[0, 3], 22, [24, 26], 81, 82],
                  12: [[0, 4], 21, 22, 25, 26, 82],
                  13: [[0, 2], [21, 24]],
                  14: [[0, 2], [21, 24]],
                  15: [[0, 3], [21, 25]],
                  16: [[0, 2], [21, 23]],
                  17: [[0, 2], [21, 23]],
                  18: [[0, 2], [21, 25], 81]
              },
              35: {
                  0: [0],
                  1: [[0, 5], 11, [21, 25], 28, 81, 82],
                  2: [[0, 6], [11, 13]],
                  3: [[0, 5], 22],
                  4: [[0, 3], 21, [23, 30], 81],
                  5: [[0, 5], 21, [24, 27], [81, 83]],
                  6: [[0, 3], [22, 29], 81],
                  7: [[0, 2], [21, 25], [81, 84]],
                  8: [[0, 2], [21, 25], 81],
                  9: [[0, 2], [21, 26], 81, 82]
              },
              36: {
                  0: [0],
                  1: [[0, 5], 11, [21, 24]],
                  2: [[0, 3], 22, 81],
                  3: [[0, 2], 13, [21, 23]],
                  4: [[0, 3], 21, [23, 30], 81, 82],
                  5: [[0, 2], 21],
                  6: [[0, 2], 22, 81],
                  7: [[0, 2], [21, 35], 81, 82],
                  8: [[0, 3], [21, 30], 81],
                  9: [[0, 2], [21, 26], [81, 83]],
                  10: [[0, 2], [21, 30]],
                  11: [[0, 2], [21, 30], 81]
              },
              37: {
                  0: [0],
                  1: [[0, 5], 12, 13, [24, 26], 81],
                  2: [[0, 3], 5, [11, 14], [81, 85]],
                  3: [[0, 6], [21, 23]],
                  4: [[0, 6], 81],
                  5: [[0, 3], [21, 23]],
                  6: [[0, 2], [11, 13], 34, [81, 87]],
                  7: [[0, 5], 24, 25, [81, 86]],
                  8: [[0, 2], 11, [26, 32], [81, 83]],
                  9: [[0, 3], 11, 21, 23, 82, 83],
                  10: [[0, 2], [81, 83]],
                  11: [[0, 3], 21, 22],
                  12: [[0, 3]],
                  13: [[0, 2], 11, 12, [21, 29]],
                  14: [[0, 2], [21, 28], 81, 82],
                  15: [[0, 2], [21, 26], 81],
                  16: [[0, 2], [21, 26]],
                  17: [[0, 2], [21, 28]]
              },
              41: {
                  0: [0],
                  1: [[0, 6], 8, 22, [81, 85]],
                  2: [[0, 5], 11, [21, 25]],
                  3: [[0, 7], 11, [22, 29], 81],
                  4: [[0, 4], 11, [21, 23], 25, 81, 82],
                  5: [[0, 3], 5, 6, 22, 23, 26, 27, 81],
                  6: [[0, 3], 11, 21, 22],
                  7: [[0, 4], 11, 21, [24, 28], 81, 82],
                  8: [[0, 4], 11, [21, 23], 25, [81, 83]],
                  9: [[0, 2], 22, 23, [26, 28]],
                  10: [[0, 2], [23, 25], 81, 82],
                  11: [[0, 4], [21, 23]],
                  12: [[0, 2], 21, 22, 24, 81, 82],
                  13: [[0, 3], [21, 30], 81],
                  14: [[0, 3], [21, 26], 81],
                  15: [[0, 3], [21, 28]],
                  16: [[0, 2], [21, 28], 81],
                  17: [[0, 2], [21, 29]],
                  90: [0, 1]
              },
              42: {
                  0: [0],
                  1: [[0, 7], [11, 17]],
                  2: [[0, 5], 22, 81],
                  3: [[0, 3], [21, 25], 81],
                  5: [[0, 6], [25, 29], [81, 83]],
                  6: [[0, 2], 6, 7, [24, 26], [82, 84]],
                  7: [[0, 4]],
                  8: [[0, 2], 4, 21, 22, 81],
                  9: [[0, 2], [21, 23], 81, 82, 84],
                  10: [[0, 3], [22, 24], 81, 83, 87],
                  11: [[0, 2], [21, 27], 81, 82],
                  12: [[0, 2], [21, 24], 81],
                  13: [[0, 3], 21, 81],
                  28: [[0, 2], 22, 23, [25, 28]],
                  90: [0, [4, 6], 21]
              },
              43: {
                  0: [0],
                  1: [[0, 5], 11, 12, 21, 22, 24, 81],
                  2: [[0, 4], 11, 21, [23, 25], 81],
                  3: [[0, 2], 4, 21, 81, 82],
                  4: [0, 1, [5, 8], 12, [21, 24], 26, 81, 82],
                  5: [[0, 3], 11, [21, 25], [27, 29], 81],
                  6: [[0, 3], 11, 21, 23, 24, 26, 81, 82],
                  7: [[0, 3], [21, 26], 81],
                  8: [[0, 2], 11, 21, 22],
                  9: [[0, 3], [21, 23], 81],
                  10: [[0, 3], [21, 28], 81],
                  11: [[0, 3], [21, 29]],
                  12: [[0, 2], [21, 30], 81],
                  13: [[0, 2], 21, 22, 81, 82],
                  31: [0, 1, [22, 27], 30]
              },
              44: {
                  0: [0],
                  1: [[0, 7], [11, 16], 83, 84],
                  2: [[0, 5], 21, 22, 24, 29, 32, 33, 81, 82],
                  3: [0, 1, [3, 8]],
                  4: [[0, 4]],
                  5: [0, 1, [6, 15], 23, 82, 83],
                  6: [0, 1, [4, 8]],
                  7: [0, 1, [3, 5], 81, [83, 85]],
                  8: [[0, 4], 11, 23, 25, [81, 83]],
                  9: [[0, 3], 23, [81, 83]],
                  12: [[0, 3], [23, 26], 83, 84],
                  13: [[0, 3], [22, 24], 81],
                  14: [[0, 2], [21, 24], 26, 27, 81],
                  15: [[0, 2], 21, 23, 81],
                  16: [[0, 2], [21, 25]],
                  17: [[0, 2], 21, 23, 81],
                  18: [[0, 3], 21, 23, [25, 27], 81, 82],
                  19: [0],
                  20: [0],
                  51: [[0, 3], 21, 22],
                  52: [[0, 3], 21, 22, 24, 81],
                  53: [[0, 2], [21, 23], 81]
              },
              45: {
                  0: [0],
                  1: [[0, 9], [21, 27]],
                  2: [[0, 5], [21, 26]],
                  3: [[0, 5], 11, 12, [21, 32]],
                  4: [0, 1, [3, 6], 11, [21, 23], 81],
                  5: [[0, 3], 12, 21],
                  6: [[0, 3], 21, 81],
                  7: [[0, 3], 21, 22],
                  8: [[0, 4], 21, 81],
                  9: [[0, 3], [21, 24], 81],
                  10: [[0, 2], [21, 31]],
                  11: [[0, 2], [21, 23]],
                  12: [[0, 2], [21, 29], 81],
                  13: [[0, 2], [21, 24], 81],
                  14: [[0, 2], [21, 25], 81]
              },
              46: {
                  0: [0],
                  1: [0, 1, [5, 8]],
                  2: [0, 1],
                  3: [0, [21, 23]],
                  90: [[0, 3], [5, 7], [21, 39]]
              },
              50: {
                  0: [0],
                  1: [[0, 19]],
                  2: [0, [22, 38], [40, 43]],
                  3: [0, [81, 84]]
              },
              51: {
                  0: [0],
                  1: [0, 1, [4, 8], [12, 15], [21, 24], 29, 31, 32, [81, 84]],
                  3: [[0, 4], 11, 21, 22],
                  4: [[0, 3], 11, 21, 22],
                  5: [[0, 4], 21, 22, 24, 25],
                  6: [0, 1, 3, 23, 26, [81, 83]],
                  7: [0, 1, 3, 4, [22, 27], 81],
                  8: [[0, 2], 11, 12, [21, 24]],
                  9: [[0, 4], [21, 23]],
                  10: [[0, 2], 11, 24, 25, 28],
                  11: [[0, 2], [11, 13], 23, 24, 26, 29, 32, 33, 81],
                  13: [[0, 4], [21, 25], 81],
                  14: [[0, 2], [21, 25]],
                  15: [[0, 3], [21, 29]],
                  16: [[0, 3], [21, 23], 81],
                  17: [[0, 3], [21, 25], 81],
                  18: [[0, 3], [21, 27]],
                  19: [[0, 3], [21, 23]],
                  20: [[0, 2], 21, 22, 81],
                  32: [0, [21, 33]],
                  33: [0, [21, 38]],
                  34: [0, 1, [22, 37]]
              },
              52: {
                  0: [0],
                  1: [[0, 3], [11, 15], [21, 23], 81],
                  2: [0, 1, 3, 21, 22],
                  3: [[0, 3], [21, 30], 81, 82],
                  4: [[0, 2], [21, 25]],
                  5: [[0, 2], [21, 27]],
                  6: [[0, 3], [21, 28]],
                  22: [0, 1, [22, 30]],
                  23: [0, 1, [22, 28]],
                  24: [0, 1, [22, 28]],
                  26: [0, 1, [22, 36]],
                  27: [[0, 2], 22, 23, [25, 32]]
              },
              53: {
                  0: [0],
                  1: [[0, 3], [11, 14], 21, 22, [24, 29], 81],
                  3: [[0, 2], [21, 26], 28, 81],
                  4: [[0, 2], [21, 28]],
                  5: [[0, 2], [21, 24]],
                  6: [[0, 2], [21, 30]],
                  7: [[0, 2], [21, 24]],
                  8: [[0, 2], [21, 29]],
                  9: [[0, 2], [21, 27]],
                  23: [0, 1, [22, 29], 31],
                  25: [[0, 4], [22, 32]],
                  26: [0, 1, [21, 28]],
                  27: [0, 1, [22, 30]], 28: [0, 1, 22, 23],
                  29: [0, 1, [22, 32]],
                  31: [0, 2, 3, [22, 24]],
                  34: [0, [21, 23]],
                  33: [0, 21, [23, 25]],
                  35: [0, [21, 28]]
              },
              54: {
                  0: [0],
                  1: [[0, 2], [21, 27]],
                  21: [0, [21, 29], 32, 33],
                  22: [0, [21, 29], [31, 33]],
                  23: [0, 1, [22, 38]],
                  24: [0, [21, 31]],
                  25: [0, [21, 27]],
                  26: [0, [21, 27]]
              },
              61: {
                  0: [0],
                  1: [[0, 4], [11, 16], 22, [24, 26]],
                  2: [[0, 4], 22],
                  3: [[0, 4], [21, 24], [26, 31]],
                  4: [[0, 4], [22, 31], 81],
                  5: [[0, 2], [21, 28], 81, 82],
                  6: [[0, 2], [21, 32]],
                  7: [[0, 2], [21, 30]],
                  8: [[0, 2], [21, 31]],
                  9: [[0, 2], [21, 29]],
                  10: [[0, 2], [21, 26]]
              },
              62: {
                  0: [0],
                  1: [[0, 5], 11, [21, 23]],
                  2: [0, 1],
                  3: [[0, 2], 21],
                  4: [[0, 3], [21, 23]],
                  5: [[0, 3], [21, 25]],
                  6: [[0, 2], [21, 23]],
                  7: [[0, 2], [21, 25]],
                  8: [[0, 2], [21, 26]],
                  9: [[0, 2], [21, 24], 81, 82],
                  10: [[0, 2], [21, 27]],
                  11: [[0, 2], [21, 26]],
                  12: [[0, 2], [21, 28]],
                  24: [0, 21, [24, 29]],
                  26: [0, 21, [23, 30]],
                  29: [0, 1, [21, 27]],
                  30: [0, 1, [21, 27]]
              },
              63: {
                  0: [0],
                  1: [[0, 5], [21, 23]],
                  2: [0, 2, [21, 25]],
                  21: [0, [21, 23], [26, 28]],
                  22: [0, [21, 24]],
                  23: [0, [21, 24]],
                  25: [0, [21, 25]],
                  26: [0, [21, 26]],
                  27: [0, 1, [21, 26]],
                  28: [[0, 2], [21, 23]]
              },
              64: {
                  0: [0],
                  1: [0, 1, [4, 6], 21, 22, 81],
                  2: [[0, 3], 5, [21, 23]],
                  3: [[0, 3], [21, 24], 81],
                  4: [[0, 2], [21, 25]],
                  5: [[0, 2], 21, 22]
              },
              65: {
                  0: [0],
                  1: [[0, 9], 21],
                  2: [[0, 5]],
                  21: [0, 1, 22, 23],
                  22: [0, 1, 22, 23],
                  23: [[0, 3], [23, 25], 27, 28],
                  28: [0, 1, [22, 29]],
                  29: [0, 1, [22, 29]],
                  30: [0, 1, [22, 24]], 31: [0, 1, [21, 31]],
                  32: [0, 1, [21, 27]],
                  40: [0, 2, 3, [21, 28]],
                  42: [[0, 2], 21, [23, 26]],
                  43: [0, 1, [21, 26]],
                  90: [[0, 4]], 27: [[0, 2], 22, 23]
              },
              71: { 0: [0] },
              81: { 0: [0] },
              82: { 0: [0] }
          };
          
          var provincial  = parseInt(value.substr(0, 2), 10),
              prefectural = parseInt(value.substr(2, 2), 10),
              county      = parseInt(value.substr(4, 2), 10);
          
          if (!adminDivisionCodes[provincial] || !adminDivisionCodes[provincial][prefectural]) {
              return false;
          }
          var inRange  = false,
              rangeDef = adminDivisionCodes[provincial][prefectural];
          for (var i = 0; i < rangeDef.length; i++) {
              if (($.isArray(rangeDef[i]) && rangeDef[i][0] <= county && county <= rangeDef[i][1])
                  || (!$.isArray(rangeDef[i]) && county === rangeDef[i]))
              {
                  inRange = true;
                  break;
              }
          }

          if (!inRange) {
              return false;
          }
          
          // Check date of birth
          var dob;
          if (value.length === 18) {
              dob = value.substr(6, 8);
          } else /* length == 15 */ { 
              dob = '19' + value.substr(6, 6);
          }
          var year  = parseInt(dob.substr(0, 4), 10),
              month = parseInt(dob.substr(4, 2), 10),
              day   = parseInt(dob.substr(6, 2), 10);
          if (!$.fn.bootstrapValidator.helpers.date(year, month, day)) {
              return false;
          }
          
          // Check checksum (18-digit system only)
          if (value.length === 18) {
              var sum    = 0,
                  weight = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
              for (i = 0; i < 17; i++) {
                  sum += parseInt(value.charAt(i), 10) * weight[i];
              }
              sum = (12 - (sum % 11)) % 11;
              var checksum = (value.charAt(17).toUpperCase() !== 'X') ? parseInt(value.charAt(17), 10) : 10;
              return checksum === sum;
          }
          
          return true;
      },
      
      /**
       * Validate Czech national identification number (RC)
       * Examples:
       * - Valid: 7103192745, 991231123
       * - Invalid: 1103492745, 590312123
       *
       * @param {String} value The ID
       * @returns {Boolean}
       */
      _cz: function(value) {
          if (!/^\d{9,10}$/.test(value)) {
              return false;
          }
          var year  = 1900 + parseInt(value.substr(0, 2), 10),
              month = parseInt(value.substr(2, 2), 10) % 50 % 20,
              day   = parseInt(value.substr(4, 2), 10);
          if (value.length === 9) {
              if (year >= 1980) {
                  year -= 100;
              }
              if (year > 1953) {
                  return false;
              }
          } else if (year < 1954) {
              year += 100;
          }

          if (!$.fn.bootstrapValidator.helpers.date(year, month, day)) {
              return false;
          }

          // Check that the birth date is not in the future
          if (value.length === 10) {
              var check = parseInt(value.substr(0, 9), 10) % 11;
              if (year < 1985) {
                  check = check % 10;
              }
              return (check + '' === value.substr(9, 1));
          }

          return true;
      },

      /**
       * Validate Danish Personal Identification number (CPR)
       * Examples:
       * - Valid: 2110625629, 211062-5629
       * - Invalid: 511062-5629
       *
       * @see https://en.wikipedia.org/wiki/Personal_identification_number_(Denmark)
       * @param {String} value The ID
       * @returns {Boolean}
       */
      _dk: function(value) {
          if (!/^[0-9]{6}[-]{0,1}[0-9]{4}$/.test(value)) {
              return false;
          }
          value = value.replace(/-/g, '');
          var day   = parseInt(value.substr(0, 2), 10),
              month = parseInt(value.substr(2, 2), 10),
              year  = parseInt(value.substr(4, 2), 10);

          switch (true) {
              case ('5678'.indexOf(value.charAt(6)) !== -1 && year >= 58):
                  year += 1800;
                  break;
              case ('0123'.indexOf(value.charAt(6)) !== -1):
              case ('49'.indexOf(value.charAt(6)) !== -1 && year >= 37):
                  year += 1900;
                  break;
              default:
                  year += 2000;
                  break;
          }

          return $.fn.bootstrapValidator.helpers.date(year, month, day);
      },

      /**
       * Validate Estonian Personal Identification Code (isikukood)
       * Examples:
       * - Valid: 37605030299
       *
       * @see http://et.wikipedia.org/wiki/Isikukood
       * @param {String} value The ID
       * @returns {Boolean}
       */
      _ee: function(value) {
          // Use the same format as Lithuanian Personal Code
          return this._lt(value);
      },

      /**
       * Validate Spanish personal identity code (DNI)
       * Support i) DNI (for Spanish citizens) and ii) NIE (for foreign people)
       *
       * Examples:
       * - Valid: i) 54362315K, 54362315-K; ii) X24