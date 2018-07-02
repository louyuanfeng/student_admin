<?php
  header('Content-Type: text/html; charset=UTF-8');
  $id = $_GET['id'];
  $conn= new mysqli('localhost','root','','db_student_admin','3306');
  //2.定义sql语句
  $sql = "delete from student_score where id = $id";
  $conn ->query("SET CHARACTER SET 'utf8'");//读库
  //3.发送SQL语句
  // 删除成功返回true， 不然为false
  $result = $conn -> query($sql);
  if($result) {
    echo "<script>
            alert('删除成功');
            location.href = 'manager.php';
          </script>";
  } else {
    echo "<script>
          alert('删除失败');
          location.href = 'manager.php';
        </script>";
  }
  $conn->close()
 ?>
