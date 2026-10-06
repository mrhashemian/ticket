(function () {
  "use strict";

  const DATA_KEY = "ticketData";

  function hasDirectIcon(el, className) {
    return Array.from(el.children).some(function (child) {
      return child.tagName === "I" && child.classList.contains(className);
    });
  }

  function setTextNodeValue(node, value) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    node.nodeValue = node.nodeValue.replace(node.nodeValue.trim(), value);
  }

  function firstTextChild(el) {
    if (!el) return null;
    for (let i = 0; i < el.childNodes.length; i++) {
      const n = el.childNodes[i];
      if (n.nodeType === Node.TEXT_NODE && n.nodeValue.trim()) return n;
    }
    return null;
  }

  function nextTextSibling(el) {
    let n = el && el.nextSibling;
    while (n) {
      if (n.nodeType === Node.TEXT_NODE && n.nodeValue.trim()) return n;
      n = n.nextSibling;
    }
    return null;
  }

  /** Flex row that holds origin | train image | destination */
  function getRouteRow() {
    const img = document.querySelector('img[src*="Printtrain3"]');
    if (!img) return null;
    let el = img.parentElement;
    while (el && el !== document.body) {
      const style = el.getAttribute("style") || "";
      if (style.indexOf("display: flex") !== -1 && style.indexOf("gap: 40px") !== -1) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function applyTicketData(data) {
    const routeRow = getRouteRow();
    if (routeRow && routeRow.children.length >= 3) {
      const originCol = routeRow.children[0];
      const destCol = routeRow.children[2];

      // Origin city: text node after مبداء label
      const originLabel = originCol.querySelector(".bi-geo-alt-fill");
      if (originLabel && originLabel.parentElement) {
        setTextNodeValue(nextTextSibling(originLabel.parentElement), data.origin);
      }

      // Destination city: first text node inside the city wrapper (sibling of مقصد label)
      const destIcon = destCol.querySelector(".bi-geo-alt:not(.bi-geo-alt-fill)");
      const destLabel = destIcon && destIcon.parentElement;
      const destCityWrap = destLabel && destLabel.nextElementSibling;
      if (destCityWrap) {
        setTextNodeValue(firstTextChild(destCityWrap), data.destination);

        // Arrival time only (nested div under city wrap)
        const arriveBox = destCityWrap.querySelector("div");
        if (arriveBox && hasDirectIcon(arriveBox, "bi-clock-history")) {
          arriveBox.innerHTML =
            '<i class="bi bi-clock-history"></i> ' + data.arriveTime;
        }
      }

      // Departure datetime: leaf div with both clock + calendar icons (no nested divs)
      const departDiv = Array.from(originCol.querySelectorAll("div")).find(function (el) {
        if (el.querySelector("div")) return false;
        return (
          hasDirectIcon(el, "bi-clock-history") &&
          hasDirectIcon(el, "bi-calendar2-check")
        );
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
    }

    // Train number + serial — only the labeled value divs, not whole body
    document.querySelectorAll("div").forEach(function (el) {
      if (el.children.length || !el.parentElement) return;
      const label = el.parentElement.querySelector("div");
      if (!label || label === el) return;
      const labelText = label.textContent.trim();
      if (labelText === "شماره قطار" && el.textContent.trim() === "730") {
        el.textContent = data.trainNo;
      }
      if (labelText === "سریال بلیت" && el.textContent.trim() === "839021283") {
        el.textContent = data.serial;
      }
    });

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

    // Prices: only in passenger card + total box (class-based / known sample strings in those areas)
    const priceSpans = document.querySelectorAll(".price-row span, .final-price span");
    priceSpans.forEach(function (span) {
      if (span.textContent.indexOf("420,000ریال") !== -1) {
        span.textContent = data.priceFormatted + "ریال";
      }
    });

    const totalNumeric = Array.from(document.querySelectorAll("strong")).find(function (el) {
      return el.textContent.trim() === "420,000";
    });
    if (totalNumeric) totalNumeric.textContent = data.priceFormatted;

    const totalWords = Array.from(document.querySelectorAll("strong")).find(function (el) {
      return el.textContent.indexOf("چهارصد و بيست هزار") !== -1;
    });
    if (totalWords) totalWords.textContent = data.priceWords + " ";

    // Stop stations: origin then destination (only inside that block)
    const stopsBox = Array.from(document.querySelectorAll("div")).find(function (el) {
      return (
        (el.getAttribute("style") || "").indexOf("margin-top:2px") !== -1 &&
        el.textContent.indexOf("ایستگاه هایی که قطار در آنها توقف دارد") !== -1
      );
    });
    if (stopsBox) {
      const strongs = stopsBox.querySelectorAll("strong");
      if (strongs[0]) strongs[0].textContent = data.origin;
      if (strongs[1]) strongs[1].textContent = data.destination;
    }

    // ثبت: 3 hours before departure — only this span, leave صادرکننده name alone
    if (data.issueDateTime) {
      const issueSpan = Array.from(document.querySelectorAll("span")).find(function (el) {
        return el.textContent.indexOf("ثبت:") === 0;
      });
      if (issueSpan) {
        issueSpan.textContent = "ثبت:" + data.issueDateTime;
      }
    }
  }

  function readTicketData() {
    // Primary: URL ?d= (reliable on GitHub Pages)
    try {
      const param = new URLSearchParams(window.location.search).get("d");
      if (param) return JSON.parse(param);
    } catch (err) {
      console.warn("URL ticket data parse failed", err);
    }

    // Fallback: localStorage
    try {
      const raw = localStorage.getItem(DATA_KEY);
      if (raw) return JSON.parse(raw);
    } catch (err) {
      console.warn("localStorage ticket data parse failed", err);
    }

    return null;
  }

  function run() {
    const data = readTicketData();
    if (data) {
      try {
        applyTicketData(data);
        // Keep localStorage in sync for back-button draft restore
        try {
          localStorage.setItem(DATA_KEY, JSON.stringify(data));
        } catch (err) {
          /* ignore quota / private mode */
        }
      } catch (err) {
        console.warn("ticketData apply failed", err);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
