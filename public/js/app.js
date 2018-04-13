document.addEventListener("DOMContentLoaded", function() {

  document.querySelector('#tweet-textarea').addEventListener('keyup', function (e) {
    const characters = e.target.value.length;
    e.target.nextElementSibling.textContent = 280 - characters;
  });

});
