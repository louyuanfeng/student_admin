<?php
    header('Content-Type: text/html; charset=UTF-8');
    include "public/public_db.php";
    $username = $_POST['student_name'];
    $score = $_POST['score'];
    $mark = isset($_POST['mark'])? $_POST['mark'] : '';
    $id = $_COOKIE['id'];
    $sql_insert = "INSERT INTO student_score (student_name, score, mark, teacher_id) VALUES ('$username', $score, ' $mark', $id)";
    $conn = new db();
    $row = $conn->Query($sql_insert, null);
    if($row) {
      $sql = "select id, student_name, score, mark from student_score ORDER BY id desc";
      $arr = $conn->Query($sql, 2);
      $array = array("code"=>"200", "msg"=> "", "data"=> $arr);
    } else {
      $array = array("code"=>"1001", "msg"=> "添加失败");
    }
    echo json_encode($array);
?>