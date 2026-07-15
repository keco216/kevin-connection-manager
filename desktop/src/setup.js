// Einrichtungsansicht: Adresse entgegennehmen und an den Hauptprozess
// reichen. Der prüft sie, speichert sie und lädt anschließend Guacamole in
// dieses Fenster – ein Erfolgsfall braucht hier also keine Reaktion.

const form = document.getElementById("setup-form");
const input = document.getElementById("server-url");
const submit = document.getElementById("submit");
const error = document.getElementById("error");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  error.hidden = true;
  submit.disabled = true;
  submit.textContent = "Verbinde …";

  const result = await window.kcm.saveServerUrl(input.value);

  if (!result.ok) {
    error.textContent = result.error;
    error.hidden = false;
    submit.disabled = false;
    submit.textContent = "Verbinden";
    input.focus();
  }
});
