<?php
         header("Content-type: text/html; charset=UTF-8");
         // 遍历数据
         include "public/public_db.php";
         $id = $_COOKIE['id'];
         $sql = "select id, student_name, score, mark from student_score where teacher_id=$id";
         $coon = new db();
         $row = $coon->Query($sql, 1);
         // 找到数据
         if($row) {
           // 返回用户基本信息
           $array = array("code"=>"200", "msg"=> "", "data"=>  $row);
         } else {
           $array = array("code"=>"1001", "msg"=> "获取数据失败");
         }
         echo json_encode($array);
        //  var_dump($rows);
?>