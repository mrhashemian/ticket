(function () {
  "use strict";

  const DATA_KEY = "ticketData";

  function replaceExactText(root, from, to) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && node.nodeValue.trim() === from) {
        node.nodeValue = node.nodeValue.replace(from, to);
        return true;
      }
    }
    return false;
  }

  function replaceSubstring(root, from, to) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && node.nodeValue.indexOf(from) !== -1) {
        node.nodeValue = node.nodeValue.replace(from, to);
        return true;
      }
    }
    return false;
  }

  function findHeaderCities() {
    const originLabel = Array.from(document.querySelectorAll("div")).find(
      function (el) {
        return el.childNodes.length && el.textContent.trim() === "مبداء" ||
          (el.querySelector(".bi-geo-alt-fill") && el.textContent.indexOf("مبداء") !== -1 && el.children.length <= 2);
      }
    );
    const destLabel = Array.from(document.querySelectorAll("div")).find(
      function (el) {
        return el.querySelector(".bi-geo-alt") && !el.querySelector(".bi-geo-alt-fill") &&
          el.textContent.indexOf("مقصد") !== -1;
      }
    );
    return { originLabel, destLabel };
  }

  function setCityAfterLabel(labelEl, city) {
    if (!labelEl) return;

    // Origin: bare text node right after the label div
    let node = labelEl.nextSibling;
    while (node) {
      if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim()) {
        node.nodeValue = node.nodeValue.replace(node.nodeValue.trim(), city);
        return;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        // Destination: city text is the first non-empty text node inside the next div
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        let t;
        while ((t = walker.nextNode())) {
          if (t.nodeValue && t.nodeValue.trim()) {
            t.nodeValue = t.nodeValue.replace(t.nodeValue.trim(), city);
            return;
          }
        }
        return;
      }
      node = node.nextSibling;
    }
  }

  function applyTicketData(data) {
    const { originLabel, destLabel } = findHeaderCities();
    setCityAfterLabel(originLabel, data.origin);
    setCityAfterLabel(destLabel, data.destination);

    // Departure: weekday + date + time (same markup as original)
    const departDiv = Array.from(document.querySelectorAll("div")).find(function (el) {
      return el.querySelector(".bi-clock-history") && el.querySelector(".bi-calendar2-check");
    });
    if (departDiv) {
      departDiv.innerHTML =
        '<i class="bi bi-clock-history"></i> ' +
        data.departWeekday +
        " " +
        data.departDate +
        ' - <i class="bi bi-calendar2-check"></i> ' +
        data.departTime +
        "  ";
    }

    // Arrival: time only — same as original template (no date)
    if (destLabel && destLabel.parentElement) {
      const destCol = destLabel.parentElement;
      const timeBox = Array.from(destCol.querySelectorAll("div")).find(function (el) {
        return el.querySelector(".bi-clock-history") && !el.querySelector(".bi-calendar2-check");
      });
      if (timeBox) {
        timeBox.innerHTML =
          '<i class="bi bi-clock-history"></i> ' + data.arriveTime;
      }
    }

    replaceExactText(document.body, "730", data.trainNo);
    replaceExactText(document.body, "839021283", data.serial);

    document.querySelectorAll(".label2").forEach(function (label) {
      const val = label.nextElementSibling;
      if (!val) return;
      const key = label.textContent.trim();
      if (key === "سالن:") val.textContent = data.wagon;
      if (key === "کوپه:") val.textContent = data.coupe;
      if (key === "صندلی:") val.textContent = data.seat;
    });

    const fonts = document.querySelectorAll(".passenger-font");
    if (fonts[0]) fonts[0].textContent = data.passengerName;
    if (fonts[1]) fonts[1].textContent = data.nationalCode;

    // بهای بلیت + پرداختی
    replaceSubstring(document.body, "420,000ریال", data.priceFormatted + "ریال");
    replaceSubstring(document.body, "420,000ریال", data.priceFormatted + "ریال");
    // جمع کل عددی
    replaceExactText(document.body, "420,000", data.priceFormatted);

    const wordsStrong = Array.from(document.querySelectorAll("strong")).find(function (el) {
      return el.textContent.indexOf("چهارصد و بيست هزار") !== -1;
    });
    if (wordsStrong) wordsStrong.textContent = data.priceWords + " ";

    // Stop stations (original: two <strong> cities)
    const stopsRow = Array.from(document.querySelectorAll("div")).find(function (el) {
      return el.textContent.indexOf("ایستگاه هایی که قطار در آنها توقف دارد") !== -1;
    });
    if (stopsRow) {
      const strongs = stopsRow.querySelectorAll("strong");
      if (strongs[0]) strongs[0].textContent = data.origin;
      if (strongs[1]) strongs[1].textContent = data.destination;
    }
  }

  function run() {
    const raw = sessionStorage.getItem(DATA_KEY);
    if (raw) {
      try {
        applyTicketData(JSON.parse(raw));
      } catch (err) {
        console.warn("ticketData parse failed", err);
      }
    }
    window.print();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
