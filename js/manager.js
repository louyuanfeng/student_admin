var manager = (function(){
    var $tbody = $('#tbody');
    var $saveBtn = $('#wq-save-score');
    var $studentName =$("#wq-name");
    var $studentScore = $("#wq-score");
    var $studentMark = $("#wq-mark");
    // 定义全局数据
    var allData = [];
    return {
        init: function() {
            // 添加事件绑定
            this.events();
            // 获取数据
            this.getData();
        },
        // 获取数据
        getData() {
            var _this = this
            $.post('php/get_date.php', function(json) {
                if(json.code == 200) {
                // 遍历表格
                   _this.insertData(json.data);
                   allData = json.data;
                }
            }, "json");
        },
        // 插入数据
        insertData(data) {
            // 清空原有数据
            $tbody.html('')
            var frag = document.createDocumentFragment();
            for(let i =0 ; i < data.length; i++) {
                var tr = document.createElement('tr');
                // 循环对象用for  in
                for(let t in  data[i]) {
                    var td = document.createElement('td');
                    td.innerHTML = data[i][t];
                    tr.appendChild(td);
                }
                //  补一个操作栏td
                var td = document.createElement('td');
                td.innerHTML = `<button class="btn btn-danger">删除</button>
                                <button class="btn btn-warning">修改</button>`
                tr.appendChild(td);
                frag.appendChild(tr);
            }
            $tbody.append(frag);
        },
        // 添加一条数据
        addData(data) {
            // 通过返回添加的一天新数据， 插入到所有数据中
            allData.push(data);
            // 遍历所有数据，插入dom元素
            this.insertData(allData);
        },
        upData() {

        },
        delData(id, tr) {
            var params = {
                id: id
            }
            $.post('php/del.php', params, function(json) {
                if(json.code == 200) {
                    // 输出数据
                    tr.remove();
                }
            }, "json")
        },
        // 所有事件定义在该方法里
        events: function() {
            var _this = this;
            $tbody.on('click', '.btn-danger', function() {
                // this  获取的是按钮
                // 获取tr
                var tr = $(this).closest('tr');
                // console.log(tr);
                // 获取id
                var id = tr.find("td").eq(0).html();
                // console.log(id);
                // 获取id后发送ajax
                _this.delData(id, tr);
            })
            // 修改按钮
            $tbody.on('click', '.btn-warning', function() {
                // 把修改按钮转换成确定按钮
                // jq链式调用
                // 改变属性
                $(this).html('确定').attr('class', 'btn btn-success');
                // 找到当前行
                var tr = $(this).closest('tr');
                // 同过tr找td
                tdAll = tr.find("td");
                for(let i = 1; i < tdAll.length -1; i++) {
                    var val = tdAll.eq(i).html();
                    tdAll.eq(i).html(`<input type="text" value="${val}">`);
                }

            })
            $tbody.on('click', '.btn-success', function() {
                var _this = $(this)
                var tr = _this.closest('tr');
                // 同过tr找td
                tdAll = tr.find("td");
                var params = {
                    id: tdAll.eq(0).html(),
                    username: tdAll.eq(1).find("input").val(),
                    score: tdAll.eq(2).find("input").val(),
                    mark: tdAll.eq(3).find("input").val()
                }
                console.log(params);
                $.post('php/update.php', params, function(json) {
                    if(json.code == 200) {
                        // 成功修改数据以后， 再把input框替换为文字值
                        _this.html('修改').attr('class', 'btn btn-warning');
                        for(let i = 1; i < tdAll.length -1; i++) {
                            var val = tdAll.eq(i).find("input").val();
                            tdAll.eq(i).html(val);
                        }
                    }
                }, "json")
                

            })
            $saveBtn.on('click', function() {
                // 获取三个文本框的值
                var params = {
                    student_name: $studentName.val(),
                    score: $studentScore.val(),
                    mark: $studentMark.val()
                }
                console.log(params);
                // 发送ajax
                $.post('php/insert.php', params, function(json) {
                    if(json.code==200) {
                        _this.addData(json.data);
                    }
                }, "json")
                // 设置回调函数
            })
        }
    }
})()
manager.init();