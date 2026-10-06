(function () {
  "use strict";

  const PRICE_KEY = "ticketDefaultPrice";
  const DATA_KEY = "ticketData";
  const DEFAULT_PRICE = 550000;
  const SERIAL_LENGTH = 9;

  const WEEKDAYS = [
    "یک شنبه",
    "دو شنبه",
    "سه شنبه",
    "چهار شنبه",
    "پنج شنبه",
    "جمعه",
    "شنبه",
  ];

  const ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
  const TENS = [
    "",
    "ده",
    "بیست",
    "سی",
    "چهل",
    "پنجاه",
    "شصت",
    "هفتاد",
    "هشتاد",
    "نود",
  ];
  const TEENS = [
    "ده",
    "یازده",
    "دوازده",
    "سیزده",
    "چهارده",
    "پانزده",
    "شانزده",
    "هفده",
    "هجده",
    "نوزده",
  ];
  const HUNDREDS = [
    "",
    "صد",
    "دویست",
    "سیصد",
    "چهارصد",
    "پانصد",
    "ششصد",
    "هفتصد",
    "هشتصد",
    "نهصد",
  ];

  function toEnglishDigits(str) {
    return String(str)
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
  }

  function parsePrice(value) {
    const n = parseInt(toEnglishDigits(value).replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) ? n : NaN;
  }

  function formatNumber(n) {
    return Math.round(n).toLocaleString("en-US");
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function formatJalali(j) {
    return j.jy + "/" + pad2(j.jm) + "/" + pad2(j.jd);
  }

  function threeDigitWords(n) {
    if (n === 0) return "";
    const parts = [];
    const h = Math.floor(n / 100);
    const rem = n % 100;
    if (h) parts.push(HUNDREDS[h]);
    if (rem >= 10 && rem <= 19) {
      parts.push(TEENS[rem - 10]);
    } else {
      const t = Math.floor(rem / 10);
      const o = rem % 10;
      if (t) parts.push(TENS[t]);
      if (o) parts.push(ONES[o]);
    }
    return parts.join(" و ");
  }

  function numberToPersianWords(n) {
    n = Math.round(Math.abs(n));
    if (n === 0) return "صفر";
    const scales = [
      { value: 1e9, name: "میلیارد" },
      { value: 1e6, name: "میلیون" },
      { value: 1e3, name: "هزار" },
    ];
    const parts = [];
    for (const scale of scales) {
      if (n >= scale.value) {
        const count = Math.floor(n / scale.value);
        n %= scale.value;
        parts.push(threeDigitWords(count) + " " + scale.name);
      }
    }
    if (n > 0) parts.push(threeDigitWords(n));
    return parts.join(" و ");
  }

  function normalizeTime(raw) {
    const s = toEnglishDigits(raw).trim();
    const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!m) return null;
    const h = +m[1];
    const min = +m[2];
    if (h > 23 || min > 59) return null;
    return pad2(h) + ":" + pad2(min);
  }

  function fillTimeOptions(selectId) {
    const select = document.getElementById(selectId);
    select.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.textContent = "انتخاب ساعت";
    select.appendChild(placeholder);

    // 24-hour times every 5 minutes — one list, no AM/PM
    for (let h = 0; h < 24; h++) {
      for (let min = 0; min < 60; min += 5) {
        const value = pad2(h) + ":" + pad2(min);
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = value;
        select.appendChild(opt);
      }
    }
  }

  function randomSerial(length) {
    let s = "";
    for (let i = 0; i < length; i++) {
      s += Math.floor(Math.random() * 10);
    }
    // avoid leading zero to look more like real serials
    if (s[0] === "0") s = String(1 + Math.floor(Math.random() * 9)) + s.slice(1);
    return s;
  }

  function fillDateOptions() {
    const select = document.getElementById("tripDate");
    select.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.textContent = "انتخاب تاریخ";
    select.appendChild(placeholder);

    if (typeof jalaali === "undefined" || typeof jalaali.toJalaali !== "function") {
      showError("کتابخانه تاریخ جلالی بارگذاری نشد.");
      return;
    }

    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    [
      { label: "امروز", date: today },
      { label: "فردا", date: tomorrow },
    ].forEach(function (item) {
      const j = jalaali.toJalaali(
        item.date.getFullYear(),
        item.date.getMonth() + 1,
        item.date.getDate()
      );
      const formatted = formatJalali(j);
      const weekday = WEEKDAYS[item.date.getDay()];
      const opt = document.createElement("option");
      opt.value = formatted;
      opt.textContent = item.label + " — " + weekday + " " + formatted;
      opt.dataset.weekday = weekday;
      select.appendChild(opt);
    });
  }

  const form = document.getElementById("ticket-form");
  const errorEl = document.getElementById("form-error");
  const priceInput = document.getElementById("price");

  function loadPrice() {
    const stored = localStorage.getItem(PRICE_KEY);
    const n = stored != null ? parsePrice(stored) : DEFAULT_PRICE;
    priceInput.value = formatNumber(Number.isFinite(n) ? n : DEFAULT_PRICE);
  }

  function savePrice() {
    const n = parsePrice(priceInput.value);
    if (Number.isFinite(n)) {
      localStorage.setItem(PRICE_KEY, String(n));
      priceInput.value = formatNumber(n);
    }
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.add("show");
  }

  function clearError() {
    errorEl.textContent = "";
    errorEl.classList.remove("show");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearError();

    if (!form.route.value) return showError("مسیر را انتخاب کنید.");

    const route = form.route.value;
    const [origin, destination] =
      route === "qom-tehran" ? ["قم", "تهران"] : ["تهران", "قم"];

    const name = form.passengerName.value.trim();
    const nationalRaw = toEnglishDigits(form.nationalCode.value).replace(
      /[^\d]/g,
      ""
    );
    const wagon = form.wagon.value.trim();
    const coupe = form.coupe.value.trim();
    const seat = form.seat.value.trim();
    const trainNo = toEnglishDigits(form.trainNo.value).trim();
    const dateOpt = form.tripDate.selectedOptions[0];
    const departTime = normalizeTime(form.departTime.value);
    const arriveTime = normalizeTime(form.arriveTime.value);
    const price = parsePrice(priceInput.value);

    if (!name) return showError("نام مسافر را وارد کنید.");
    if (nationalRaw.length !== 10)
      return showError("کد ملی باید ۱۰ رقم باشد.");
    if (!wagon || !coupe || !seat)
      return showError("سالن، کوپه و صندلی را وارد کنید.");
    if (!trainNo) return showError("شماره قطار را وارد کنید.");
    if (!dateOpt || !dateOpt.value) return showError("تاریخ را انتخاب کنید.");
    if (!departTime) return showError("ساعت حرکت را انتخاب کنید.");
    if (!arriveTime) return showError("ساعت رسیدن را انتخاب کنید.");
    if (!Number.isFinite(price) || price < 0)
      return showError("قیمت نامعتبر است.");

    savePrice();

    const tripDate = dateOpt.value;
    const weekday = dateOpt.dataset.weekday || WEEKDAYS[new Date().getDay()];
    const serial = randomSerial(SERIAL_LENGTH);
    const priceFormatted = formatNumber(price);
    const priceWords = numberToPersianWords(price);

    const data = {
      origin,
      destination,
      departWeekday: weekday,
      departDate: tripDate,
      departTime,
      arriveDate: tripDate,
      arriveTime,
      trainNo,
      serial,
      wagon,
      coupe,
      seat,
      passengerName: name,
      nationalCode: nationalRaw + "#",
      priceFormatted,
      priceWords,
    };

    sessionStorage.setItem(DATA_KEY, JSON.stringify(data));
    window.open("Ticket.html", "_blank");
  });

  document.getElementById("reset-form").addEventListener("click", function () {
    form.reset();
    clearError();
    fillDateOptions();
    fillTimeOptions("departTime");
    fillTimeOptions("arriveTime");
    loadPrice();
  });

  priceInput.addEventListener("blur", savePrice);
  fillDateOptions();
  fillTimeOptions("departTime");
  fillTimeOptions("arriveTime");
  loadPrice();
})();
