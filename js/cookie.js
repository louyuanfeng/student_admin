function setCookie(cname, cvalue, exdays) {
  var d = new Date();
  d = new Date(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
  var expires = "expires=" + d;
document.cookie = cname + "=" + cvalue + "; " + expires+";"
  console.log(d)
}



//获取cookie
function getCookie(cname) {
  var name = cname + "=";
  var ca = document.cookie.split(';');
  for(var i = 0; i < ca.length; i++) {
      var c = ca[i];
      while(c.charAt(0) == ' ') c = c.substring(1);
      if(c.indexOf(name) != -1) return c.substring(name.length, c.length);
  }
  return "";
}

//删除 cookie
function clearCookie(name) {
  setCookie(name, "", -1);
}
