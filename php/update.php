<?php
    include 'public/public_db.php';
    header('Content-Type: text/html; charset=UTF-8');
    $username = $_POST['username'];
    $score = $_POST['score'];
    $id = $_POST['id'];
    $mark = isset($_POST['mark'])? $_POST['mark'] : '';
    $coon = new db();
    $sql_upate = "UPDATE student_score SET student_name = '$username', score =  $score, mark = '$mark' where id = $id";
    // var_dump($sql_upate);
    $result = $coon->Query($sql_upate, null);
    if($result) {
      $arr = array("code"=> "200", "msg" => "");
    } else {
      $arr = array("code"=> "1004", "msg" => "修改失败");
    }
    echo json_encode($arr);
 
?>