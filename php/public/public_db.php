<?php
  class db
  {
      public $host = "127.0.0.1";//定义默认连接方式
      public $account = "root";//定义默认用户名
      public $pass = "";//定义默认的密码
      public $db_name = "wrong_question";//定义默认的数据库名
      public $port = "3306";
  //成员方法   是用来执行sql语句的方法
      public function Query($sql,$type=1)
  //两个参数：sql语句，判断返回1查询或是增删改的返回
      {
  //造一个连接对象，参数是上面的那四个
          $db = new mysqli($this->host,$this->account,$this->pass,$this->db_name,$this->port);
          $r = $db->query($sql);
          
          if($type == "1") {
            return $r->fetch_all();//查询语句，返回数组
          } else if ($type == "2") {
            return $r->fetch_assoc();//查询语句，返回关联数组, 一条
          }
          else {
              return $r;
          }
      }

  }
?>