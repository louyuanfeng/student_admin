~function () {
  //->getXHR:创建AJAX对象(使用惰性思想进行封装,兼容所有的浏览器的)
  var getXHR = function () {
      var flag = false, xhr = null, ary = [function () {
          return new XMLHttpRequest;
      }, function () {
          return new ActiveXObject("Microsoft.XMLHTTP");
      }, function () {
          return new ActiveXObject("Msxml2.XMLHTTP");
      }, function () {
          return new ActiveXObject("Msxml3.XMLHTTP");
      }];
      for (var i = 0, len = ary.length; i < len; i++) {
          var temp = ary[i];
          try {
              xhr = temp();
              getXHR = temp;
              flag = true;
              break;
          } catch (e) {

          }
      }
      if (!flag) {
          throw new Error("your browser is not support ajax~");
      }
      return xhr;
  };

  //->sendAJAX:发送AJAX请求的方法
  //options:它是一个对象数据类型的值,把需要传递进来的参数和值都已键值对的方式传递进来
  var sendAJAX = function (options) {
      //->参数初始化
      var _default = {
          url: "",
          type: "get",
          async: true,
          data: null,
          success: null
      };
      for (var key in options) {
          if (options.hasOwnProperty(key)) {
              _default[key] = options[key];
          }
      }

      //->发送请求
      var xhr = getXHR();
      if (_default["type"].toLowerCase() === "get") {
          //->GET请求还需要在URL的末尾追加随机数
          var suffix = _default["url"].indexOf("?") > -1 ? "&" : "?";
          _default["url"] += suffix + "_=" + Math.random();
      }
      xhr.open(_default["type"], _default["url"], _default["async"]);
      xhr.onreadystatechange = function () {
          if (xhr.readyState === 4 && /^2\d{2}$/.test(xhr.status)) {
              var data = "JSON" in window ? JSON.parse(xhr.responseText) : eval("(" + xhr.responseText + ")");
              _default["success"] && _default["success"](data);
          }
      };
      xhr.send(_default["data"]);
  };

  window.sendAJAX = sendAJAX;
}();