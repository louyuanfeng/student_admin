<?php
    include 'public_db.php';
    header('Content-Type: text/html; charset=UTF-8');
    $username = $_POST['username'];
    $score = $_POST['score'];
    $id = $_POST['id'];
    $mark = isset($_POST['mark'])? $_POST['mark'] : '';
    $coon = new db();
    $sql_upate = "UPDATE student_score SET student_name = '$username', score =  $score, mark = '$mark' where id = $id";
    var_dump($sql_upate);
    $result = $coon->Query($sql_upate, 3);
    if($result) {
      echo "<script>
              alert('修改成功');
              location.href = 'manager.php';
            </script>";
    }
    else {
      echo "<script>
            alert('修改失败');
            location.href = 'manager.php';
          </script>";
    }
?>