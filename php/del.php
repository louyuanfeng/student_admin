<?php
  header('Content-Type: text/html; charset=UTF-8');
  include "public/public_db.php";
  $id = $_POST['id'];
  $coon = new db();
  $sql = "delete from student_score where id = $id";
  $result = $coon -> Query($sql, null);
  if($result) {
    $arr = array("msg" => "", "code" => "200");
  }  else {
    $arr = array("msg" => "删除失败", "code" => "1002");
  }
  echo json_encode($arr);
 ?>
