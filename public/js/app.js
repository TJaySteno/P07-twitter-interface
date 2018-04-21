document.addEventListener("DOMContentLoaded", function() {

  // Continually update character count on the page
  document.querySelector('#tweet-textarea').addEventListener('keyup', function (e) {
    const characters = e.target.value.length;
    e.target.nextElementSibling.textContent = 280 - characters;
  });

  // Set styling for the error div, if present
  const errorDiv = document.querySelector('.error--container');
  if (errorDiv) errorDiv.style = "margin-left: 40px;"

  // On clicking 'Tweet' button, form the tweet into a parameter to request, and redirect the browser
  document.querySelector('.button-primary').addEventListener('click', function (e) {
    e.preventDefault();

    const textarea = e.target.parentNode.previousElementSibling.querySelector('#tweet-textarea');
    const encodedTweet = encodeURI(textarea.value);

    const pathname = `/tweet/${encodedTweet}`;
    const url = window.location.origin + pathname;
    window.location.href = url;
  });
});
