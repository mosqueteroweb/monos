const backBtn = document.getElementById("backBtn");
const chartWrapper = document.querySelector(".chart-wrapper");

backBtn.addEventListener("click", () => {
  // Dentro del juego se cierra la capa; abierta sola, vuelve a la portada.
  if (window.parent !== window) {
    window.parent.postMessage({ type: "CLOSE_TRACKING" }, location.origin);
  } else {
    location.href = "index.html";
  }
});
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && window.parent !== window) backBtn.click();
});

function showMessage(lines) {
  const box = document.createElement("div");
  box.className = "no-data";
  box.setAttribute("role", "status");
  lines.forEach((line, i) => {
    if (i > 0) box.appendChild(document.createElement("br"));
    box.appendChild(document.createTextNode(line));
  });
  chartWrapper.replaceChildren(box);
}

// Resumen en texto de la gráfica, para lectores de pantalla.
function describeChart(data) {
  const last = data.points.length - 1;
  const parts = data.ids.map((id) => {
    const track = data.history[id];
    const ruinedAt = track.indexOf(0);
    if (ruinedAt >= 0) {
      return `jugador ${id}: arruinado hacia la ronda ${data.points[ruinedAt].toLocaleString()}`;
    }
    return `jugador ${id}: ${track[last].toLocaleString()} €`;
  });
  return `Evolución de la banca durante ${data.points[last].toLocaleString()} rondas. ${parts.join("; ")}.`;
}

function loadData() {
  try {
    const data = JSON.parse(localStorage.getItem("seguimientoData"));
    // Formato actual: { ids, points, history }. Los datos antiguos no traen points.
    if (data && Array.isArray(data.points) && data.history) return data;
  } catch (e) {
    Logger.error("Error reading tracking data:", e);
  }
  return null;
}

const data = loadData();

if (!data) {
  showMessage(["No hay datos de seguimiento disponibles.", "Juega una partida primero."]);
} else if (typeof Chart === "undefined") {
  showMessage(["No se pudo cargar la librería de gráficos.", "Comprueba la conexión a internet."]);
} else {
  const colors = [
    "#00ffff", // Cyan
    "#ff9800", // Orange
    "#e040fb", // Purple
    "#00e676", // Green
  ];

  const datasets = data.ids.map((id, index) => ({
    label: "Jugador " + id,
    data: data.history[id],
    borderColor: colors[index % colors.length],
    backgroundColor: "transparent",
    borderWidth: 2,
    pointRadius: 0, // Hide points for cleaner line
    tension: 0.1,
  }));

  document.getElementById("trackingChart").setAttribute("aria-label", describeChart(data));

  Chart.defaults.color = "#a0a0a0";
  Chart.defaults.borderColor = "#333";

  new Chart(document.getElementById("trackingChart").getContext("2d"), {
    type: "line",
    data: {
      labels: data.points.map((round) => round.toLocaleString()),
      datasets,
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
