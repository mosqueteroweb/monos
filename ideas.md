# Lluvia de Ideas y Requisitos - Proyecto 02 (SPA)

Este documento recopila la evolución de las ideas y decisiones técnicas para la aplicación "Battle Royale: Cara o Cruz".

## 1. Concepto Inicial
> "Simulación visual de 1000 jugadores apostando en un juego de cara o cruz hasta que se quedan sin dinero o alcanzan grandes ganancias." (Usuario)

**Objetivo:**
- Visualizar la "suerte" y la "ruina" en masa.
- 1000 Agentes autónomos.
- Banca Inicial: 1000€ cada uno.

## 2. Evolución de la Mecánica

### Fase A: "Todos contra Todos" (Descartada)
- Idea original: Partidas aleatorias entre jugadores.
- Problema: Complejidad de emparejamiento.

### Fase B: "Lanzamientos Individuales" (Implementada inicialmente)
- Cada jugador lanza su propia moneda.
- 50% Gana / 50% Pierde.
- Resultado: Ruido aleatorio, sin patrones claros de grupo.

### Fase C: "Batalla de Equipos" (Lógica Actual)
> "que los primeros 500 jugadores apuesten siempre a cara y los 500 ultimos a cruz" (Usuario)
- **Mecánica:** Se lanza UNA sola moneda por ronda para todos.
- **Equipo Cara (0-499):** Gana si sale Cara.
- **Equipo Cruz (500-999):** Gana si sale Cruz.
- **Apuesta:** **1€** por tirada (Cambio solicitado: de 10€ a 1€).
- **Apuesta:** **1€** por tirada (Cambio solicitado: de 10€ a 1€).
- **Resultados:** Correlación total. Creación de "mareas" de ganadores y perdedores.

### Fase D: "Elección Aleatoria vs Moneda Única" (Lógica Solicitada)
> "que jueguen de forma aleatoria encada juego... el jugador 'elige' aleatoriamnete si apuesta a cara o a cruz" (Usuario)
- **Mecánica:** Se lanza UNA moneda (realidad compartida).
- **Agente:** En cada turno, CADA agente elige aleatoriamente (50/50) si apuesta Cara o Cruz.
- **Resultado:** Vuelve a ser estocástico/individual. Aunque la moneda es la misma, la elección de apuesta es ruido blanco. Matemáticamente similar a la Fase B.

## 3. Visualización y UI

### Matriz de Colores
Códigos de color según la banca del jugador:
- ⚫ **Negro**: Bancarrota (<= 0€).
- 🔴 **Rojo**: Crítico (<= 100€).
- 🟠 **Naranja**: Peligro (<= 500€).
- 🟡 **Amarillo**: Zona Segura (501€ - 1499€).
- 🔵 **Azul**: Ganancia (>= 1500€).
- 🟢 **Verde**: Éxito (>= 2000€).
- ✨ **Verde Neón**: Racha Ganadora (>= 3000€, aumentando brillo).

### Layout
- **Canvas**: Ocupa el 90% del ancho y 80% del alto de la pantalla.
- **Controles**: Botones de PAUSE y RESET.
- **Contador**: Muestra el número total de partidas ("Matches") en tiempo real.
- **Tooltip**: Al pasar el mouse, muestra ID del Agente y Banca exacta.

## 4. Stack Tecnológico
- **Core**: Vanilla JS (Sin frameworks).
- Una SPA con CSS, HTML y JS en un unico archivo llamado index.html

## 5. Optimizaciones
- **Frecuencia de Actualización**: Para acelerar la simulación y evitar parpadeos molestos, el bucle principal ejecuta **1000 partidas (matches)** en memoria antes de actualizar el gráfico y el contador una sola vez. Esto permite simular millones de partidas en cuestión de minutos.

## 6. Mejoras de Datos
- **Registro de Bancarrota**: Se guarda el número de la ronda (match) exacta en la que un jugador pierde todo su dinero.
- **Tabla de Estadísticas en Vivo**: Se muestra un panel con los porcentajes de jugadores en cada estado (Arruinados, Perdiendo, Ganando, x2, x3, x5, x10) actualizado en cada refresco del gráfico.
- **Toggle**: Un botón para mostrar u ocultar esta tabla y no tapar la visión si no se desea.

## 7. Diseño Responsivo (Mobile First)
- **Layout**: Cambio a estructura Flex Column.
  - **Header**: Título + Botones de acción (Iconos).
  - **Canvas**: Ocupa el espacio central.
  - **Footer**: Contador de partidas + Tabla de estadísticas (debajo del canvas).
- **Estética**: Estilo "App Nativa". Botones minimalistas.




