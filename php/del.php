<?php
  // header('Content-Type: text/html; charset=UTF-8');
  include "public/public_db.php";
  $id = $_POST['id'];
  $conn = new db();
  $sql = "delete from student_score where id = $id";
  $result = $conn -> Query($sql, null);
  if($result) {
    $arr = array("code"=> "200", "msg" => "");
  } else {
    $arr = array("code"=> "1001", "msg" => "删除失败");
  }
  echo json_encode($arr);
 ?>
