const backBtn = document.getElementById("backBtn");
const ctx = document.getElementById("trackingChart").getContext("2d");

// Navigation
const urlParams = new URLSearchParams(location.search);
const fromPage = urlParams.get("from");

backBtn.addEventListener("click", () => {
  if (fromPage === "webworker.html") {
    location.href = "webworker.html";
  } else {
    location.href = "index.html";
  }
});

// Load Data
const rawData = localStorage.getItem("seguimientoData");

if (!rawData) {
  document.querySelector(".chart-wrapper").innerHTML =
    '<div class="no-data">No hay datos de seguimiento disponibles.<br>Juega una partida primero.</div>';
} else {
  const data = JSON.parse(rawData);
  const history = data.history; // { id: [val1, val2...], ... }
  const ids = data.ids;
  // The number of labels should match the longest history
  // However, all tracked players should have roughly the same history length
  // (give or take 1 if game ended mid-loop, but likely identical)

  const maxLength = Math.max(
    ...Object.values(history).map((arr) => arr.length),
  );

  // Sampling for performance if too many points
  // Chart.js can handle a lot, but 100k might be sluggish on mobile.
  // Let's sample down to ~2000 points max for display.
  const sampleRate = Math.max(1, Math.floor(maxLength / 2000));

  const labels = [];
  for (let i = 0; i < maxLength; i += sampleRate) {
    labels.push(i);
  }

  const datasets = [];
  const colors = [
    "#00ffff", // Cyan
    "#ff9800", // Orange
    "#e040fb", // Purple
    "#00e676", // Green
  ];

  ids.forEach((id, index) => {
    const playerHistory = history[id];
    const sampledData = [];
    for (let i = 0; i < playerHistory.length; i += sampleRate) {
      sampledData.push(playerHistory[i]);
    }

    datasets.push({
      label: "Jugador " + id,
      data: sampledData,
      borderColor: colors[index % colors.length],
      backgroundColor: "transparent",
      borderWidth: 2,
      pointRadius: 0, // Hide points for cleaner line
      tension: 0.1,
    });
  });

  // Initialize Chart
  Chart.defaults.color = "#a0a0a0";
  Chart.defaults.borderColor = "#333";

  new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          labels: {
            color: "#e0e0e0",
            font: { size: 12 },
          },
        },
        tooltip: {
          backgroundColor: "rgba(0, 0, 0, 0.9)",
          titleColor: "#fff",
          bodyColor: "#e0e0e0",
          callbacks: {
            title: (context) => "Ronda " + context[0].label,
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "Ronda",
            color: "#a0a0a0",
          },
          ticks: {
            maxTicksLimit: 10,
          },
        },
        y: {
          title: {
            display: true,
            text: "Banca (€)",
            color: "#a0a0a0",
          },
          grid: {
            color: "#333",
          },
        },
      },
      animation: false, // Disable animation for large datasets for better perf
    },
  });
}
