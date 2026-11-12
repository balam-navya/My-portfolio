    "use strict";

    document.documentElement.classList.add("js");

    const root = document.documentElement;
    const revealItems = document.querySelectorAll("[data-reveal]");
    const progressBar = document.getElementById("scroll-progress");
    const navLinks = Array.from(document.querySelectorAll(".nav-link"));
    const sections = Array.from(document.querySelectorAll("main section[id]"));

    function markVisible(element) {
      element.classList.add("is-visible");
    }

    if ("IntersectionObserver" in window) {
      const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            markVisible(entry.target);
          } else if (
            entry.boundingClientRect.top > window.innerHeight * 0.88 ||
            (entry.target.closest(".about-section") && entry.boundingClientRect.bottom < 0)
          ) {
            // Re-arm below the viewport as before, and also above it for About cards.
            // This lets the About cards reveal again when the visitor scrolls upward.
            entry.target.classList.remove("is-visible");
          }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

      revealItems.forEach((element) => {
        const delay = Number(element.dataset.delay || 0);
        element.style.setProperty("--reveal-delay", delay + "ms");
        revealObserver.observe(element);
      });
    } else {
      revealItems.forEach(markVisible);
    }

    requestAnimationFrame(() => root.classList.add("is-ready"));

    function updateScrollProgress() {
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;
      if (progressBar) {
        progressBar.style.width = Math.min(1, Math.max(0, progress)) * 100 + "%";
      }
    }
    window.addEventListener("scroll", updateScrollProgress, { passive: true });
    window.addEventListener("resize", updateScrollProgress);
    updateScrollProgress();

    function setActiveNav(activeId) {
      navLinks.forEach((link) => {
        const isActive = link.getAttribute("href") === "#" + activeId;
        link.classList.toggle("is-active", isActive);
        if (isActive) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
    }

    function scrollToSection(targetId, updateHistory = true) {
      const targetElement = document.getElementById(targetId);
      if (!targetElement) return;

      const header = document.querySelector(".site-header");
      const headerOffset = header ? header.offsetHeight + 18 : 88;
      const targetTop = targetId === "home"
        ? 0
        : Math.max(0, targetElement.getBoundingClientRect().top + window.scrollY - headerOffset);

      setActiveNav(targetId);
      if (updateHistory) {
        history.pushState({ page: targetId }, "", "#" + targetId);
      }
      window.scrollTo({ top: targetTop, behavior: "smooth" });
    }

    function updateActiveSectionOnScroll() {
      const scrollPosition = window.scrollY + window.innerHeight * 0.32;
      let currentId = "home";

      for (const section of sections) {
        if (section.offsetTop <= scrollPosition) {
          currentId = section.id;
        }
      }

      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 24) {
        currentId = sections[sections.length - 1].id;
      }

      setActiveNav(currentId);
    }

    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (event) => {
        const targetId = link.getAttribute("href").slice(1);
        if (targetId && document.getElementById(targetId)) {
          event.preventDefault();
          scrollToSection(targetId);
        }
      });
    });

    window.addEventListener("scroll", updateActiveSectionOnScroll, { passive: true });
    window.addEventListener("resize", updateActiveSectionOnScroll);
    window.addEventListener("popstate", () => {
      const targetId = location.hash.slice(1) || "home";
      scrollToSection(targetId, false);
    });
    updateActiveSectionOnScroll();

// Contact form: use FormSubmit's native POST flow instead of fetch/AJAX.
    // This avoids the cross-origin request hanging in some static/local preview setups.
    const contactForm = document.getElementById("contact-form");
    const formStatus = document.getElementById("form-status");
    const formRefreshButton = document.getElementById("form-refresh-button");
    if (contactForm) {
      // Clear submitted contact details after the visitor returns from Gmail and refreshes.
      let clearContactOnReload = false;
      try {
        const navigationEntry = performance.getEntriesByType("navigation")[0];
        clearContactOnReload = navigationEntry?.type === "reload" ||
          sessionStorage.getItem("portfolioClearContactOnReload") === "1";
        sessionStorage.removeItem("portfolioClearContactOnReload");
      } catch (_) {}
      if (clearContactOnReload) {
        const clearContactFields = () => {
          contactForm.reset();
          contactForm.querySelectorAll("input:not([type=hidden]), textarea").forEach((field) => {
            field.value = "";
          });
        };
        clearContactFields();
        // pageshow runs after the browser has restored any cached form values.
        window.addEventListener("pageshow", clearContactFields, { once: true });
      }

      const subjectInput = document.getElementById("sender-subject");
      const subjectField = document.getElementById("contact-form-subject");
      const nextField = document.getElementById("contact-form-next");

      // FormSubmit requires an absolute return URL. Set it only on a hosted site.
      if (nextField && (window.location.protocol === "http:" || window.location.protocol === "https:")) {
        const returnUrl = new URL(window.location.href);
        returnUrl.searchParams.set("contact", "success");
        returnUrl.hash = "contact";
        nextField.value = returnUrl.href;
      }

      // Let the browser submit the form normally; do not intercept or hold the page
      // on a permanent "Sending..." state.
      contactForm.addEventListener("submit", (event) => {
        if (subjectField && subjectInput && subjectInput.value.trim()) {
          subjectField.value = subjectInput.value.trim();
        }

        // A locally opened HTML file cannot post to FormSubmit reliably.
        // Open Gmail's web composer instead of relying on a configured mailto handler.
        if (window.location.protocol === "file:") {
          event.preventDefault();
          const name = document.getElementById("sender-name").value.trim();
          const email = document.getElementById("sender-email").value.trim();
          const subject = subjectInput ? subjectInput.value.trim() : "Portfolio enquiry";
          const message = document.getElementById("sender-message").value.trim();
          const body = [
            `Name: ${name}`,
            `Email: ${email}`,
            "",
            message
          ].join("\n");
          const gmailParams = new URLSearchParams({
            view: "cm",
            fs: "1",
            to: "deepika62811@gmail.com",
            su: subject || "Portfolio enquiry",
            body
          });
          const gmailUrl = `https://mail.google.com/mail/?${gmailParams.toString()}`;
          const gmailTab = window.open(gmailUrl, "_blank");

          if (formStatus) {
            formStatus.replaceChildren();
            formStatus.hidden = false;
            if (gmailTab) {
              // Keep the portfolio tab available while Gmail opens separately.
              try { gmailTab.opener = null; } catch (_) {}
              formStatus.hidden = true;
              // Reveal the refresh control beside Send Message; Gmail cannot report its Send action to this page.
              if (formRefreshButton) {
                formRefreshButton.hidden = false;
                formRefreshButton.addEventListener("click", () => {
                  window.location.reload();
                }, { once: true });
              }
            } else {
              formStatus.append("Your browser blocked the new tab. ");
              const openLink = document.createElement("a");
              openLink.href = gmailUrl;
              openLink.target = "_blank";
              openLink.rel = "noopener noreferrer";
              openLink.textContent = "Open Gmail to send your message";
              formStatus.append(openLink);
            }
          }
        }
      });

      // Show confirmation after FormSubmit redirects the visitor back to this page.
      const params = new URLSearchParams(window.location.search);
      if (formStatus && params.get("contact") === "success") {
        formStatus.textContent = "Thank you! Your message has been submitted successfully.";
        formStatus.hidden = false;
        params.delete("contact");
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("contact");
        window.history.replaceState({}, "", cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
      }
    }

    const resumeLink = document.getElementById("view-resume-link");
    if (resumeLink) {
      try {
        const b64 = "JVBERi0xLjQKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNyAwIFIgL0Y0IDggMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMSAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EtQm9sZCAvRW5jb2RpbmcgL1dpbkFuc2lFbmNvZGluZyAvTmFtZSAvRjIgL1N1YnR5cGUgL1R5cGUxIC9UeXBlIC9Gb250Cj4+CmVuZG9iago0IDAgb2JqCjw8Ci9BIDw8Ci9TIC9VUkkgL1R5cGUgL0FjdGlvbiAvVVJJIChtYWlsdG86ZGVlcGlrYTYyODExQGdtYWlsLmNvbSkKPj4gL0JvcmRlciBbIDAgMCAwIF0gL1JlY3QgWyAyNTQuMjI3NiA3NDIuNzk5NCAzNjMuMjc1MiA3NTMuODM5NCBdIC9TdWJ0eXBlIC9MaW5rIC9UeXBlIC9Bbm5vdAo+PgplbmRvYmoKNSAwIG9iago8PAovQSA8PAovUyAvVVJJIC9UeXBlIC9BY3Rpb24gL1VSSSAoaHR0cHM6Ly9saW5rZWRpbi5jb20vaW4vYi1uYXZ5YS1kZWVwaWthLTc1YTA0MjI5NykKPj4gL0JvcmRlciBbIDAgMCAwIF0gL1JlY3QgWyAxNTAuOTY2OCA3MzAuMDk5NCAzMzEuNDcwOCA3NDEuMTM5NCBdIC9TdWJ0eXBlIC9MaW5rIC9UeXBlIC9Bbm5vdAo+PgplbmRvYmoKNiAwIG9iago8PAovQSA8PAovUyAvVVJJIC9UeXBlIC9BY3Rpb24gL1VSSSAoaHR0cHM6Ly9naXRodWIuY29tL2JhbGFtLW5hdnlhKQo+PiAvQm9yZGVyIFsgMCAwIDAgXSAvUmVjdCBbIDM0NC4wOTMyIDczMC4wOTk0IDQ0NC4zMDg4IDc0MS4xMzk0IF0gL1N1YnR5cGUgL0xpbmsgL1R5cGUgL0Fubm90Cj4+CmVuZG9iago3IDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhLUJvbGRPYmxpcXVlIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMyAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjggMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EtT2JsaXF1ZSAvRW5jb2RpbmcgL1dpbkFuc2lFbmNvZGluZyAvTmFtZSAvRjQgL1N1YnR5cGUgL1R5cGUxIC9UeXBlIC9Gb250Cj4+CmVuZG9iago5IDAgb2JqCjw8Ci9Bbm5vdHMgWyA0IDAgUiA1IDAgUiA2IDAgUiBdIC9Db250ZW50cyAxMyAwIFIgL01lZGlhQm94IFsgMCAwIDU5NS4yNzU2IDg0MS44ODk4IF0gL1BhcmVudCAxMiAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgCiAgL1RyYW5zIDw8Cgo+PiAvVHlwZSAvUGFnZQo+PgplbmRvYmoKMTAgMCBvYmoKPDwKL1BhZ2VNb2RlIC9Vc2VOb25lIC9QYWdlcyAxMiAwIFIgL1R5cGUgL0NhdGFsb2cKPj4KZW5kb2JqCjExIDAgb2JqCjw8Ci9BdXRob3IgKEIuIE5hdnlhIERlZXBpa2EpIC9DcmVhdGlvbkRhdGUgKEQ6MjAyNjExMDgwOTQ5NTUrMDAnMDAnKSAvQ3JlYXRvciAoXCh1bnNwZWNpZmllZFwpKSAvS2V5d29yZHMgKCkgL01vZERhdGUgKEQ6MjAyNjExMDgwOTQ5NTUrMDAnMDAnKSAvUHJvZHVjZXIgKFJlcG9ydExhYiBQREYgTGlicmFyeSAtIFwob3BlbnNvdXJjZVwpKSAKICAvU3ViamVjdCAoSmF2YSBGdWxsIFN0YWNrIERldmVsb3BlciAvIFNvZnR3YXJlIERldmVsb3BlcikgL1RpdGxlIChCLiBOYXZ5YSBEZWVwaWthIC0gUmVzdW1lKSAvVHJhcHBlZCAvRmFsc2UKPj4KZW5kb2JqCjEyIDAgb2JqCjw8Ci9Db3VudCAxIC9LaWRzIFsgOSAwIFIgXSAvVHlwZSAvUGFnZXMKPj4KZW5kb2JqCjEzIDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDMzMTcKPj4Kc3RyZWFtCkdhdWBWRC0sSDYoQjMvdForbykrbG9icE85JCRnTSZbQjxUOmtTLXVDXF9OYSxOS1tTOiw1WyxsaHBQVGJRSXVcZCsjTTQvZVBzMkIicFAsZmZNJl5hLGNwIy1aYyNXJktSR1tBPSwzYitpRGxJKVAnYERvXjhvLGBiTT5bQlUzLjQoOmdUTmwnPnVCNSgnSU1WVyJtRWRTLyx0Kko2MmwyJyhHSEZTWkpvKVdgXitFL2wvOjEqKFhubCxhIzllKCNGOklRXCYlaSgwVyRjQmdhVkZQUTBrcWsjcTxDJU5kNHJeNHIkQUoiLF9JXTxObCozSG1kYlxaNzE5OTkqOig8azNzWzprO3RcTFtYJzY5Syd0SGBgUVxWc0tHazhLTD1dJFQ+UGxAdClJbkFBTTRATF0kNCZncDw1YC9vRjdxXXVyNGtnUDA9KWlgRjdjWzVIUl9nVC1rUjtiREQ2cjhxXzlFT3UhPFZmXjpCSzM/PzFSJ002VFpOZypfK0NtbDRXLlRTVzVIQmtCNFwsZVlrRFNocVtFUSdmci0oMjdAQUhWXFxbbFghZXJzcyNvKmVPKzVWOi8zJUMlR18xUFJVPFJmMGxCNEtXMV5wM29Aa1ZjKztMW2xhcStXUUFRYystKWdGXTNEVCc5JVRzKzBcblddY1tBQzAoVGZWKmBATiszRjJmYj9vQVpGJjRhKzJXYFpEXmxcX2lvclZXTWE3Rl4paG08PmIiL0dXQGJKcTBtZzRkNWBIT2xNUzs5cThaWz9rTig6OzA5PlArayZkZGxRUVApJ0M1WSsqU3VGXyVYTy4/clpaI2wwIjhRLCRWO0ZIJmc2MjxKZm5PQTROVmRUSz9mVjg7a3RhVmU6SDJXJUZTYldKM2JFdUdZP2VvQC5JblpxSmxCXGJEJj8nKmRKaUpyWE41OU9QREYhaVJpUWxlRUtFJkFSLnBjdC81QDhMQDItZXJEbTNxMztrKVk4MSFQbilPKkYuZ0xeblFCS0RcLmYoRU9sWkJbSFMncypXQ2pPLyk7JlZhNFZHW2c5VUhRMlckPChTWGJKLyREYTMzOUNtSiVTRHBlMWNbMUMwbDFnSC05K0k/RlA2N1UmOnVzXElccjZXKWIoRitDRko7dCwpTllxTl0xWDctPFxuPlZvYT5rb3JlLSonWTtTOCUmIV9kY0RPU1xaP3U/ZTpVOlVJNk8zXk4nS1VYSmA/QltwLDRvPFMtayw7ZGFsQG1YXEl0ZU0jIioyVCpLbDc5VDg0SXItbCVmKGNALCpBMyxEYGBWTyk7bixQIzltbFtITTFHQGBPV2xDWFhDRl50SlNEZS9ZNVxSN0NjQG9RblsnWEAmR1dGLm5hS2VqSz9GI04uNW1uMC5RRj8qSFdoJ1NxWi05XS06PkQlcUBrSUJwajAhPShqQlhlYl8sWSEkLTUtJiooKkVJPFJtdWRBTi4+JGNjT0VXJzxbX2BvKTlsTUFhJSc5Xz4sUVpOcmJbLVVjQnQjcUoxOzY5MCc6RVhkX0pXcSZLMipXaTBNV1w9OCxBPSUhVGBFWywjM1JeQXQ9QU5RN1NPbUtzJlM4VUsmKCUxa1RdKzBGR2UpTDBDYVIzR25NO2U8MmRPQW0mXWxYRlRPdE01U0pjOyU3TjgoL0QhTW89RXE/T3NKME1obnQ4LFJqPVArTSQ5aGw6azpQNydiPS5VU2w1VHVmNGlTSisjWFEmJDw2OCpQMjszImM2LE5HPUctc01dNl00PkZObmJTQGlLXW5cKGBjPmtwRT5OPywmXldfPiRlK0ddUCJuTCZgbjxkZmJpWWs3Vlc1S2toSlA0NCxsVkpbRyRNNW0sVVVWVTQ0LUFxSjMhQUlaPDFpWjkiTilwQm9CPVlCdUhGIlhmIUxBSktaZnFuTzAhY1ltYS9qRTUlSiZDLFNeTlwpbWVJX2c2XmRgdSFOamskZEJfbEtEYW91dCNYYS5vKTE9Zz5rXCpmYC1WNFJMWUNGXTFdZjdzO0g6Kk4/Ok1ZJmBTKUdROHFXa1hwQD9yY3RlLDxoTzc4WClvODFxWEtELUEmcFNcJUojPVsoWVhWRztXL2Q8YGdYVUl1XW5lazBdPmNoLyhLSE0zZWtlK2FlPCcxOyg1JS5GQDcrJV5RMnBDT107OkJVTiZJWD9ba0sucV10JERCblZYaT4wOXJQXGs/Qkc7MS5XWmRPKS5MNF8/ZCRya1pMSCY7Y1NuU3BxLipjal1XPUBELEQ/cVA0K1F0SjFkLnU8Mi5TTEhAQlgvPSc9KCUwVzE8NDdkWGJIOVxBay9RPDlBWlZHLlQlYEg4QTZGR0JjUF5cSTtRMDtWKlwpZkhbJVBAKj1NZCRSYzolcWBSN1tbUEtgRkEwPGQxTlovbWdNaVw7aTo7I2osLjZLL1gxL0RGKlAiLmlWNkUyQS9qaCJWbXFqO0JYbEEvLkIkNDcjS2JZQkVnZ21XaElQI1csb0kvYVlPKFQ/VEhHI0BFKGEpXl5OWS5KYHJBXVpYQ3MpQDZsSUlsInMvKC51OzFhN0VfdCQ3XyNnXi9GRWUqLGVDbGBlWz0ySkUzUCFwb2Q1TmlqO3FZNmNLOGtdMVpgZyheU2JjVV9uZi9cSVhzYl8+PzZhLGI7UVJlJF1uQUYwNWs8UC9wKFVgIk47SlpXUDMvIUg9IipgVz5maDo7aGlIOzRCbk00J1lCV2UsQiNxOiMrSSZIQFtTTDhXayleUyEqPl5mWVpzZ1dvY01rRyU1LnNhXiRfZ2cnNHVnYT41SFFcX0NXYVQ+KWxaXW8uLWoiPFdWK0tkYnM4QihKKTtZYTYzWHNWaGlyXlouNzRNW2E1SDZEbHAqXSUoOj9hJD5MIy5ZVTYuPURKLUh0MVtJIlRYNi1EXylZInI9X1tWRTxmT3ReZzlGamosLSprNm5SOjNEUDJKJkAmO1sobGs2KSRXYjYiN2lFJEV0QjRoQypSX0gnUFdvJ11JcFYxYU1rWWoqPCYrX0JJU0BNSU5JIllYKDgzRmNsdVBeYnBUXk5hPjliQ2JaLTlzNTU+R1wzUVRiKigyN3MvN1VTLjlhNyk8TDFQcHUyLyRQMlcvWk8hVGgwak5NVU8rZVcySTpHN0Jwc2ZdKUcjUUwiak51MixoblBXNW8xS0Y5LjxoUWAubipcKVhkIj5uKlcpY1JHLV4/STc5NC1LMi0wK0ZoWzc2JWA6ajNwSmxEUEIjUjghZG9tSmRIU2lPRiE/Y25yTGhoWUNRU0tobjdYdDs2RCMzQF5IQkIvOiRDLj5nJzZYKFErP1ZecjtjJzkiTUFtY0xKVz5LNWNYTjFQI1NbOS89IzxAUkIrRXFvVUEuKFw7Vi9SLnBTcUE7Wl1dbSFZLDc4SmhZIipQMSt0K0wsWi9mVS8hcmwvXjpBYzNraCNBcUZFRywwQk9DQDguSiNwTUNYZjw7RyJAO2lXPi0uLlZGTDhpXS4jVVRSSjA9UW5mTHMxPzNvUnFfL01DSFEjRCI+JD5hNjdqO2NsRElAN0klNVslVzNgcSpNPFJbdXFTU3FdTVtaSEBrWGdeaCIuV1JGVSteXDg+PkBUW2Q5WlhZQG4uTylgLXVRRV5jTWBsSFRcZjM9W2ttO2Zccl5QN0c8TCZINUFwVTZabi89cl1tZGNnLldkay9vaV00TlplN0dkKnMhOzowaVYvYV9BaTthNzRjOWFkVnB0cjVHWUE8V1xJcSQnRz8yZE4sIV9NLlkmWCNNYyNIUmc2Pyo5aDJQX15kaG0+XXFNKCxTS2ZEU2svLkdmbmMxUmpGRm03Vi5dKF1fOGYpNztocihfK1JWRik1T1xtP1c0ajxLI1RvJys9VmJeOHE8ailZLSYxJVA6Y2ExR2hmM1RPcz4pPWZZYEMxLGRtJic+Z10zPyFoWFBvJGFgUHJAOj1ILCI5Kj5mL240VWZrdVFeSEdlLTIlSTwtLjllISlrVlNAPDZwO1pLLCFQKjIiVFxAR09mKHRhTjxqXnRvbE1QQEw0ZCM/LzckXXM2K2QqIWxoQjsnO21sZVBFR0ZWTVAiNzdUYVhrblRHRTNbLFVwaiInPSJdU2QpaSFJZ1dGKFpHNjgyQU43TWE6cjYuTCJ0QzlALF9xcHNVWF1bQGJxWDFkSVFSXzpHITxSRyJlXSdcTU9oI0E1VXArQWw2UEM/QEJJMzthbHFtIyZVZFE/bydlLz0oUEVfXUY8b0ZtZ1pcNj9OKzxbZG1qYlwlSUZHbVJEcC5TO20vb2RtPXNGQUNaUihvOjElQ0szUltWMCpHa2UwIk1CWDM3USVtUklUIjxmS1p1KiwmTmo6PzBXMSg4O2trQFNpbj5uT1EvIi1TJ2FZRmZWX05rUlNvIjYlRCUxRTJGYkxNYm5QRl0uNHJVSkRVNUg5IkZeO34+ZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgMTQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDYxIDAwMDAwIG4gCjAwMDAwMDAxMjIgMDAwMDAgbiAKMDAwMDAwMDIyOSAwMDAwMCBuIAowMDAwMDAwMzQxIDAwMDAwIG4gCjAwMDAwMDA1MjIgMDAwMDAgbiAKMDAwMDAwMDcyMyAwMDAwMCBuIAowMDAwMDAwOTA1IDAwMDAwIG4gCjAwMDAwMDEwMjQgMDAwMDAgbiAKMDAwMDAwMTEzOSAwMDAwMCBuIAowMDAwMDAxMzc0IDAwMDAwIG4gCjAwMDAwMDE0NDQgMDAwMDAgbiAKMDAwMDAwMTc3MSAwMDAwMCBuIAowMDAwMDAxODMxIDAwMDAwIG4gCnRyYWlsZXIKPDwKL0lEIApbPDIyNjljZWU3NzQyYTJiNWI3ZWE1NjhmYWVmYWIwNmNmPjwyMjY5Y2VlNzc0MmEyYjViN2VhNTY4ZmFlZmFiMDZjZj5dCiUgUmVwb3J0TGFiIGdlbmVyYXRlZCBQREYgZG9jdW1lbnQgLS0gZGlnZXN0IChvcGVuc291cmNlKQoKL0luZm8gMTEgMCBSCi9Sb290IDEwIDAgUgovU2l6ZSAxNAo+PgpzdGFydHhyZWYKNTI0MAolJUVPRgo=";
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: "application/pdf" });
        resumeLink.href = URL.createObjectURL(blob);
      } catch (err) {
        resumeLink.href = "data:application/pdf;base64,JVBERi0xLjQKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNyAwIFIgL0Y0IDggMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMSAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EtQm9sZCAvRW5jb2RpbmcgL1dpbkFuc2lFbmNvZGluZyAvTmFtZSAvRjIgL1N1YnR5cGUgL1R5cGUxIC9UeXBlIC9Gb250Cj4+CmVuZG9iago0IDAgb2JqCjw8Ci9BIDw8Ci9TIC9VUkkgL1R5cGUgL0FjdGlvbiAvVVJJIChtYWlsdG86ZGVlcGlrYTYyODExQGdtYWlsLmNvbSkKPj4gL0JvcmRlciBbIDAgMCAwIF0gL1JlY3QgWyAyNTQuMjI3NiA3NDIuNzk5NCAzNjMuMjc1MiA3NTMuODM5NCBdIC9TdWJ0eXBlIC9MaW5rIC9UeXBlIC9Bbm5vdAo+PgplbmRvYmoKNSAwIG9iago8PAovQSA8PAovUyAvVVJJIC9UeXBlIC9BY3Rpb24gL1VSSSAoaHR0cHM6Ly9saW5rZWRpbi5jb20vaW4vYi1uYXZ5YS1kZWVwaWthLTc1YTA0MjI5NykKPj4gL0JvcmRlciBbIDAgMCAwIF0gL1JlY3QgWyAxNTAuOTY2OCA3MzAuMDk5NCAzMzEuNDcwOCA3NDEuMTM5NCBdIC9TdWJ0eXBlIC9MaW5rIC9UeXBlIC9Bbm5vdAo+PgplbmRvYmoKNiAwIG9iago8PAovQSA8PAovUyAvVVJJIC9UeXBlIC9BY3Rpb24gL1VSSSAoaHR0cHM6Ly9naXRodWIuY29tL2JhbGFtLW5hdnlhKQo+PiAvQm9yZGVyIFsgMCAwIDAgXSAvUmVjdCBbIDM0NC4wOTMyIDczMC4wOTk0IDQ0NC4zMDg4IDc0MS4xMzk0IF0gL1N1YnR5cGUgL0xpbmsgL1R5cGUgL0Fubm90Cj4+CmVuZG9iago3IDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhLUJvbGRPYmxpcXVlIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMyAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjggMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EtT2JsaXF1ZSAvRW5jb2RpbmcgL1dpbkFuc2lFbmNvZGluZyAvTmFtZSAvRjQgL1N1YnR5cGUgL1R5cGUxIC9UeXBlIC9Gb250Cj4+CmVuZG9iago5IDAgb2JqCjw8Ci9Bbm5vdHMgWyA0IDAgUiA1IDAgUiA2IDAgUiBdIC9Db250ZW50cyAxMyAwIFIgL01lZGlhQm94IFsgMCAwIDU5NS4yNzU2IDg0MS44ODk4IF0gL1BhcmVudCAxMiAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgCiAgL1RyYW5zIDw8Cgo+PiAvVHlwZSAvUGFnZQo+PgplbmRvYmoKMTAgMCBvYmoKPDwKL1BhZ2VNb2RlIC9Vc2VOb25lIC9QYWdlcyAxMiAwIFIgL1R5cGUgL0NhdGFsb2cKPj4KZW5kb2JqCjExIDAgb2JqCjw8Ci9BdXRob3IgKEIuIE5hdnlhIERlZXBpa2EpIC9DcmVhdGlvbkRhdGUgKEQ6MjAyNjExMDgwOTQ5NTUrMDAnMDAnKSAvQ3JlYXRvciAoXCh1bnNwZWNpZmllZFwpKSAvS2V5d29yZHMgKCkgL01vZERhdGUgKEQ6MjAyNjExMDgwOTQ5NTUrMDAnMDAnKSAvUHJvZHVjZXIgKFJlcG9ydExhYiBQREYgTGlicmFyeSAtIFwob3BlbnNvdXJjZVwpKSAKICAvU3ViamVjdCAoSmF2YSBGdWxsIFN0YWNrIERldmVsb3BlciAvIFNvZnR3YXJlIERldmVsb3BlcikgL1RpdGxlIChCLiBOYXZ5YSBEZWVwaWthIC0gUmVzdW1lKSAvVHJhcHBlZCAvRmFsc2UKPj4KZW5kb2JqCjEyIDAgb2JqCjw8Ci9Db3VudCAxIC9LaWRzIFsgOSAwIFIgXSAvVHlwZSAvUGFnZXMKPj4KZW5kb2JqCjEzIDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDMzMTcKPj4Kc3RyZWFtCkdhdWBWRC0sSDYoQjMvdForbykrbG9icE85JCRnTSZbQjxUOmtTLXVDXF9OYSxOS1tTOiw1WyxsaHBQVGJRSXVcZCsjTTQvZVBzMkIicFAsZmZNJl5hLGNwIy1aYyNXJktSR1tBPSwzYitpRGxJKVAnYERvXjhvLGBiTT5bQlUzLjQoOmdUTmwnPnVCNSgnSU1WVyJtRWRTLyx0Kko2MmwyJyhHSEZTWkpvKVdgXitFL2wvOjEqKFhubCxhIzllKCNGOklRXCYlaSgwVyRjQmdhVkZQUTBrcWsjcTxDJU5kNHJeNHIkQUoiLF9JXTxObCozSG1kYlxaNzE5OTkqOig8azNzWzprO3RcTFtYJzY5Syd0SGBgUVxWc0tHazhLTD1dJFQ+UGxAdClJbkFBTTRATF0kNCZncDw1YC9vRjdxXXVyNGtnUDA9KWlgRjdjWzVIUl9nVC1rUjtiREQ2cjhxXzlFT3UhPFZmXjpCSzM/PzFSJ002VFpOZypfK0NtbDRXLlRTVzVIQmtCNFwsZVlrRFNocVtFUSdmci0oMjdAQUhWXFxbbFghZXJzcyNvKmVPKzVWOi8zJUMlR18xUFJVPFJmMGxCNEtXMV5wM29Aa1ZjKztMW2xhcStXUUFRYystKWdGXTNEVCc5JVRzKzBcblddY1tBQzAoVGZWKmBATiszRjJmYj9vQVpGJjRhKzJXYFpEXmxcX2lvclZXTWE3Rl4paG08PmIiL0dXQGJKcTBtZzRkNWBIT2xNUzs5cThaWz9rTig6OzA5PlArayZkZGxRUVApJ0M1WSsqU3VGXyVYTy4/clpaI2wwIjhRLCRWO0ZIJmc2MjxKZm5PQTROVmRUSz9mVjg7a3RhVmU6SDJXJUZTYldKM2JFdUdZP2VvQC5JblpxSmxCXGJEJj8nKmRKaUpyWE41OU9QREYhaVJpUWxlRUtFJkFSLnBjdC81QDhMQDItZXJEbTNxMztrKVk4MSFQbilPKkYuZ0xeblFCS0RcLmYoRU9sWkJbSFMncypXQ2pPLyk7JlZhNFZHW2c5VUhRMlckPChTWGJKLyREYTMzOUNtSiVTRHBlMWNbMUMwbDFnSC05K0k/RlA2N1UmOnVzXElccjZXKWIoRitDRko7dCwpTllxTl0xWDctPFxuPlZvYT5rb3JlLSonWTtTOCUmIV9kY0RPU1xaP3U/ZTpVOlVJNk8zXk4nS1VYSmA/QltwLDRvPFMtayw7ZGFsQG1YXEl0ZU0jIioyVCpLbDc5VDg0SXItbCVmKGNALCpBMyxEYGBWTyk7bixQIzltbFtITTFHQGBPV2xDWFhDRl50SlNEZS9ZNVxSN0NjQG9RblsnWEAmR1dGLm5hS2VqSz9GI04uNW1uMC5RRj8qSFdoJ1NxWi05XS06PkQlcUBrSUJwajAhPShqQlhlYl8sWSEkLTUtJiooKkVJPFJtdWRBTi4+JGNjT0VXJzxbX2BvKTlsTUFhJSc5Xz4sUVpOcmJbLVVjQnQjcUoxOzY5MCc6RVhkX0pXcSZLMipXaTBNV1w9OCxBPSUhVGBFWywjM1JeQXQ9QU5RN1NPbUtzJlM4VUsmKCUxa1RdKzBGR2UpTDBDYVIzR25NO2U8MmRPQW0mXWxYRlRPdE01U0pjOyU3TjgoL0QhTW89RXE/T3NKME1obnQ4LFJqPVArTSQ5aGw6azpQNydiPS5VU2w1VHVmNGlTSisjWFEmJDw2OCpQMjszImM2LE5HPUctc01dNl00PkZObmJTQGlLXW5cKGBjPmtwRT5OPywmXldfPiRlK0ddUCJuTCZgbjxkZmJpWWs3Vlc1S2toSlA0NCxsVkpbRyRNNW0sVVVWVTQ0LUFxSjMhQUlaPDFpWjkiTilwQm9CPVlCdUhGIlhmIUxBSktaZnFuTzAhY1ltYS9qRTUlSiZDLFNeTlwpbWVJX2c2XmRgdSFOamskZEJfbEtEYW91dCNYYS5vKTE9Zz5rXCpmYC1WNFJMWUNGXTFdZjdzO0g6Kk4/Ok1ZJmBTKUdROHFXa1hwQD9yY3RlLDxoTzc4WClvODFxWEtELUEmcFNcJUojPVsoWVhWRztXL2Q8YGdYVUl1XW5lazBdPmNoLyhLSE0zZWtlK2FlPCcxOyg1JS5GQDcrJV5RMnBDT107OkJVTiZJWD9ba0sucV10JERCblZYaT4wOXJQXGs/Qkc7MS5XWmRPKS5MNF8/ZCRya1pMSCY7Y1NuU3BxLipjal1XPUBELEQ/cVA0K1F0SjFkLnU8Mi5TTEhAQlgvPSc9KCUwVzE8NDdkWGJIOVxBay9RPDlBWlZHLlQlYEg4QTZGR0JjUF5cSTtRMDtWKlwpZkhbJVBAKj1NZCRSYzolcWBSN1tbUEtgRkEwPGQxTlovbWdNaVw7aTo7I2osLjZLL1gxL0RGKlAiLmlWNkUyQS9qaCJWbXFqO0JYbEEvLkIkNDcjS2JZQkVnZ21XaElQI1csb0kvYVlPKFQ/VEhHI0BFKGEpXl5OWS5KYHJBXVpYQ3MpQDZsSUlsInMvKC51OzFhN0VfdCQ3XyNnXi9GRWUqLGVDbGBlWz0ySkUzUCFwb2Q1TmlqO3FZNmNLOGtdMVpgZyheU2JjVV9uZi9cSVhzYl8+PzZhLGI7UVJlJF1uQUYwNWs8UC9wKFVgIk47SlpXUDMvIUg9IipgVz5maDo7aGlIOzRCbk00J1lCV2UsQiNxOiMrSSZIQFtTTDhXayleUyEqPl5mWVpzZ1dvY01rRyU1LnNhXiRfZ2cnNHVnYT41SFFcX0NXYVQ+KWxaXW8uLWoiPFdWK0tkYnM4QihKKTtZYTYzWHNWaGlyXlouNzRNW2E1SDZEbHAqXSUoOj9hJD5MIy5ZVTYuPURKLUh0MVtJIlRYNi1EXylZInI9X1tWRTxmT3ReZzlGamosLSprNm5SOjNEUDJKJkAmO1sobGs2KSRXYjYiN2lFJEV0QjRoQypSX0gnUFdvJ11JcFYxYU1rWWoqPCYrX0JJU0BNSU5JIllYKDgzRmNsdVBeYnBUXk5hPjliQ2JaLTlzNTU+R1wzUVRiKigyN3MvN1VTLjlhNyk8TDFQcHUyLyRQMlcvWk8hVGgwak5NVU8rZVcySTpHN0Jwc2ZdKUcjUUwiak51MixoblBXNW8xS0Y5LjxoUWAubipcKVhkIj5uKlcpY1JHLV4/STc5NC1LMi0wK0ZoWzc2JWA6ajNwSmxEUEIjUjghZG9tSmRIU2lPRiE/Y25yTGhoWUNRU0tobjdYdDs2RCMzQF5IQkIvOiRDLj5nJzZYKFErP1ZecjtjJzkiTUFtY0xKVz5LNWNYTjFQI1NbOS89IzxAUkIrRXFvVUEuKFw7Vi9SLnBTcUE7Wl1dbSFZLDc4SmhZIipQMSt0K0wsWi9mVS8hcmwvXjpBYzNraCNBcUZFRywwQk9DQDguSiNwTUNYZjw7RyJAO2lXPi0uLlZGTDhpXS4jVVRSSjA9UW5mTHMxPzNvUnFfL01DSFEjRCI+JD5hNjdqO2NsRElAN0klNVslVzNgcSpNPFJbdXFTU3FdTVtaSEBrWGdeaCIuV1JGVSteXDg+PkBUW2Q5WlhZQG4uTylgLXVRRV5jTWBsSFRcZjM9W2ttO2Zccl5QN0c8TCZINUFwVTZabi89cl1tZGNnLldkay9vaV00TlplN0dkKnMhOzowaVYvYV9BaTthNzRjOWFkVnB0cjVHWUE8V1xJcSQnRz8yZE4sIV9NLlkmWCNNYyNIUmc2Pyo5aDJQX15kaG0+XXFNKCxTS2ZEU2svLkdmbmMxUmpGRm03Vi5dKF1fOGYpNztocihfK1JWRik1T1xtP1c0ajxLI1RvJys9VmJeOHE8ailZLSYxJVA6Y2ExR2hmM1RPcz4pPWZZYEMxLGRtJic+Z10zPyFoWFBvJGFgUHJAOj1ILCI5Kj5mL240VWZrdVFeSEdlLTIlSTwtLjllISlrVlNAPDZwO1pLLCFQKjIiVFxAR09mKHRhTjxqXnRvbE1QQEw0ZCM/LzckXXM2K2QqIWxoQjsnO21sZVBFR0ZWTVAiNzdUYVhrblRHRTNbLFVwaiInPSJdU2QpaSFJZ1dGKFpHNjgyQU43TWE6cjYuTCJ0QzlALF9xcHNVWF1bQGJxWDFkSVFSXzpHITxSRyJlXSdcTU9oI0E1VXArQWw2UEM/QEJJMzthbHFtIyZVZFE/bydlLz0oUEVfXUY8b0ZtZ1pcNj9OKzxbZG1qYlwlSUZHbVJEcC5TO20vb2RtPXNGQUNaUihvOjElQ0szUltWMCpHa2UwIk1CWDM3USVtUklUIjxmS1p1KiwmTmo6PzBXMSg4O2trQFNpbj5uT1EvIi1TJ2FZRmZWX05rUlNvIjYlRCUxRTJGYkxNYm5QRl0uNHJVSkRVNUg5IkZeO34+ZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgMTQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDYxIDAwMDAwIG4gCjAwMDAwMDAxMjIgMDAwMDAgbiAKMDAwMDAwMDIyOSAwMDAwMCBuIAowMDAwMDAwMzQxIDAwMDAwIG4gCjAwMDAwMDA1MjIgMDAwMDAgbiAKMDAwMDAwMDcyMyAwMDAwMCBuIAowMDAwMDAwOTA1IDAwMDAwIG4gCjAwMDAwMDEwMjQgMDAwMDAgbiAKMDAwMDAwMTEzOSAwMDAwMCBuIAowMDAwMDAxMzc0IDAwMDAwIG4gCjAwMDAwMDE0NDQgMDAwMDAgbiAKMDAwMDAwMTc3MSAwMDAwMCBuIAowMDAwMDAxODMxIDAwMDAwIG4gCnRyYWlsZXIKPDwKL0lEIApbPDIyNjljZWU3NzQyYTJiNWI3ZWE1NjhmYWVmYWIwNmNmPjwyMjY5Y2VlNzc0MmEyYjViN2VhNTY4ZmFlZmFiMDZjZj5dCiUgUmVwb3J0TGFiIGdlbmVyYXRlZCBQREYgZG9jdW1lbnQgLS0gZGlnZXN0IChvcGVuc291cmNlKQoKL0luZm8gMTEgMCBSCi9Sb290IDEwIDAgUgovU2l6ZSAxNAo+PgpzdGFydHhyZWYKNTI0MAolJUVPRgo=";
      }
    }

  

    (() => {
      const viewButton = document.getElementById('view-resume-link');
      const resumeDialog = document.getElementById('resume-dialog');
      const previewImage = document.getElementById('resume-preview-image');
      const downloadLink = document.getElementById('resume-download-link');
      const closeButton = document.getElementById('resume-close-button');
      if (!viewButton || !resumeDialog || !previewImage || !downloadLink || !closeButton) return;

      const openResume = (event) => {
        if (event) event.preventDefault();
        const pdfUrl = viewButton.href;
        if (!pdfUrl || pdfUrl.endsWith('#resume')) return;
        downloadLink.href = pdfUrl;
        if (typeof resumeDialog.showModal === 'function') {
          resumeDialog.showModal();
        } else {
          resumeDialog.setAttribute('open', '');
        }
      };

      const closeResume = () => {
        if (typeof resumeDialog.close === 'function' && resumeDialog.open) {
          resumeDialog.close();
        } else {
          resumeDialog.removeAttribute('open');
        }
      };

      viewButton.addEventListener('click', openResume);
      closeButton.addEventListener('click', closeResume);
      resumeDialog.addEventListener('click', (event) => {
        if (event.target === resumeDialog) closeResume();
      });
    })();
  