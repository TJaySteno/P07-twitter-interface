document.addEventListener("DOMContentLoaded", function() {

  document.querySelector('#tweet-textarea').addEventListener('keyup', function (e) {
    const characters = e.target.value.length;
    e.target.nextElementSibling.textContent = 280 - characters;
  });

  document.querySelector('.error--container').style = "margin-left: 40px;"

  const form = document.querySelector('form');
  form.addEventListener("submit", (e) => { processForm(e) });

  function processForm (e) {
    console.log(e);
  }

});
