// Form submission handler
document.getElementById("studentForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const submitBtn = document.getElementById("submitBtn");
  const resultDiv = document.getElementById("result");
  const errorDiv = document.getElementById("error");

  // Disable submit button
  submitBtn.disabled = true;
  submitBtn.textContent = "Generating...";

  // Hide previous results
  resultDiv.style.display = "none";
  errorDiv.style.display = "none";

  // Get form data
  const formData = {
    studentId: document.getElementById("studentId").value,
    career: document.getElementById("career").value,
    admitTerm: document.getElementById("admitTerm").value,
  };

  try {
    // Send request to server
    const response = await fetch("/api/create-pass", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Show success result
      document.getElementById("passId").textContent = data.passId;
      document.getElementById("googleWalletBtn").href = data.addToWalletLink;
      resultDiv.style.display = "block";

      // Scroll to result
      resultDiv.scrollIntoView({ behavior: "smooth" });
    } else {
      // Show error
      document.getElementById("errorMessage").textContent =
        data.error || "Failed to create student card";
      errorDiv.style.display = "block";
    }
  } catch (error) {
    // Show error
    document.getElementById("errorMessage").textContent =
      "Network error: " + error.message;
    errorDiv.style.display = "block";
  } finally {
    // Re-enable submit button
    submitBtn.disabled = false;
    submitBtn.textContent = "Generate Student Card";
  }
});
