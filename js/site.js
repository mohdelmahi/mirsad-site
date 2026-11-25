(function () {
  var head = document.querySelector('.mx-head');
  if (!head) return;
  var dd = head.querySelector('.mx-dd');
  var btn = head.querySelector('.mx-ddb');
  if (dd && btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = dd.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) {
      if (!dd.contains(e.target)) { dd.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { dd.classList.remove('open'); head.classList.remove('menu-open'); }
    });
  }
  var burger = head.querySelector('.mx-burger');
  if (burger) burger.addEventListener('click', function () { head.classList.toggle('menu-open'); });
  head.querySelectorAll('.mx-links a').forEach(function (a) {
    a.addEventListener('click', function () { head.classList.remove('menu-open'); if (dd) dd.classList.remove('open'); });
  });
})();

/* Waitlist sign-up: posts to the Brevo form that feeds the "Mirsad waitlist" list */
(function () {
  var ACTION = 'https://97e697c5.sibforms.com/serve/MUIFALRdp-P0PzAiHhs6voXb9j6B725kgbqfB96bhGkohaQcwCFiR6qdLKthnCDvO-f6m7VfJE-WTaGJaocYeMc--Vs_xEJqB0BfJsnzA58M8oQCJHkjMoUmaqR-9_9lLShcKFSDNbhTsGyVQ1ZepG0NSd81btt2qn_YF7nhdkUQTxnoIUAqhmsTO8B2F6SfRv05moJLOmg7VBJKiA==';
  document.querySelectorAll('form.mx-join').forEach(function (form) {
    var action = form.getAttribute('data-action') || ACTION;
    var input = form.querySelector('input[type=email]');
    var btn = form.querySelector('button');
    var msg = form.querySelector('.mx-join-msg');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = (input.value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        msg.className = 'mx-join-msg err';
        msg.textContent = 'Please enter a valid email address.';
        input.focus();
        return;
      }
      if (form.querySelector('.hp').value) return; // bot trap
      var data = new FormData();
      data.append('EMAIL', email);
      data.append('email_address_check', '');
      data.append('locale', 'en');
      data.append('html_type', 'simple');
      btn.disabled = true;
      msg.className = 'mx-join-msg';
      msg.textContent = 'Adding you to the list...';
      fetch(action, { method: 'POST', mode: 'no-cors', body: data })
        .then(function () {
          form.classList.add('done');
          msg.className = 'mx-join-msg ok';
          var dl = form.getAttribute('data-download');
          if (dl) {
            msg.innerHTML = 'Thanks! Your PDF is ready. <a class="mx-dl" href="' + dl + '" target="_blank" rel="noopener">Download the PDF</a>';
          } else {
            msg.textContent = "You're on the list. We'll send you Mirsad updates and tips.";
          }
        })
        .catch(function () {
          btn.disabled = false;
          msg.className = 'mx-join-msg err';
          msg.textContent = 'That didn’t go through. Please try again in a moment.';
        });
    });
  });
})();

/* Floating WhatsApp chat button on every page */
(function () {
  var a = document.createElement('a');
  a.className = 'mx-wa';
  a.href = 'https://wa.me/971508182789?text=Hi%20Mirsad%2C%20I%20have%20a%20question';
  a.target = '_blank';
  a.rel = 'noopener';
  a.setAttribute('aria-label', 'Chat with Mirsad on WhatsApp');
  a.innerHTML = '<span>Chat with us on WhatsApp</span><svg viewBox="0 0 32 32" aria-hidden="true"><path fill="#fff" d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 7L3 29l6.4-2c2 1.1 4.300 1.7 6.6 1.7 7.2 0 13-5.7 13-12.8S23.2 3 16 3zm0 23.4c-2.100 0-4.1-.6-5.900-1.700l-.4-.2-3.800 1.200 1.200-3.700-.3-.4a10.4 10.4 0 0 1-1.600-5.600C5.200 10 10 5.300 16 5.300S26.8 10 26.8 15.800 22 26.400 16 26.400zm5.900-7.900c-.3-.2-1.900-.9-2.200-1s-.5-.2-.7.200-.8 1-1 1.200-.4.200-.7.100a8.700 8.700 0 0 1-4.300-3.700c-.3-.6.300-.5 .9-1.700.1-.2 0-.4 0-.5l-1-2.400c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.100-.8.400s-1 1-1 2.500 1.100 2.900 1.200 3.100c.2.2 2.100 3.200 5.100 4.500 1.900.8 2.600.9 3.600.7.600-.1 1.900-.8 2.100-1.500.3-.7.3-1.400.2-1.500l-.5-.4z"/></svg>';
  document.body.appendChild(a);
})();

/* Contact form: delivers to your inbox through Web3Forms, so your email address never appears on the site */
(function () {
  var WEB3FORMS_KEY = '2842e4c5-1af8-4b1a-a317-41d33e12cbff';
  var form = document.getElementById('mx-contact');
  if (!form) return;
  var btn = form.querySelector('.mx-send');
  var msg = form.querySelector('.mx-contact-msg');
  function val(n) { return (form.elements[n].value || '').trim(); }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var bad = [];
    ['first_name', 'last_name', 'phone', 'email', 'company', 'subject', 'message'].forEach(function (n) {
      var el = form.elements[n];
      var v = val(n);
      var ok = v.length > 0;
      if (n === 'email') ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
      if (n === 'phone') ok = v.replace(/[^0-9]/g, '').length >= 7;
      el.classList.toggle('bad', !ok);
      if (!ok) bad.push(el);
    });
    if (bad.length) {
      msg.className = 'mx-contact-msg err';
      msg.textContent = 'Please fill in all the fields. Check the email and phone number are correct.';
      bad[0].focus();
      return;
    }
    if (form.elements.botcheck.checked) return;
    if (WEB3FORMS_KEY.indexOf('PASTE') === 0) {
      msg.className = 'mx-contact-msg err';
      msg.textContent = 'The contact form is not connected yet. Please use WhatsApp for now.';
      return;
    }
    btn.disabled = true;
    msg.className = 'mx-contact-msg';
    msg.textContent = 'Sending...';
    fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        subject: 'Mirsad contact form: ' + val('subject'),
        from_name: 'Mirsad website',
        replyto: val('email'),
        'First name': val('first_name'),
        'Last name': val('last_name'),
        Telephone: val('phone'),
        Email: val('email'),
        Company: val('company'),
        Subject: val('subject'),
        Message: val('message')
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.success) throw new Error(j.message || 'failed');
        form.reset();
        msg.className = 'mx-contact-msg ok';
        msg.textContent = 'Your enquiry is sent, someone from our customer service will contact you shortly. Thank you';
      })
      .catch(function () {
        msg.className = 'mx-contact-msg err';
        msg.textContent = 'Your message could not be sent. Please try again, or message us on WhatsApp.';
      })
      .then(function () { btn.disabled = false; });
  });
})();
