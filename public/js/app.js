document.addEventListener("DOMContentLoaded", function() {

  document.querySelector('#tweet-textarea').addEventListener('keyup', function (e) {
    const characters = e.target.value.length;
    e.target.nextElementSibling.textContent = 280 - characters;
  });

  const errorDiv = document.querySelector('.error--container');
  if (errorDiv) errorDiv.style = "margin-left: 40px;"

});
