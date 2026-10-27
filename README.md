# monos
monos jugando al cara o cruz

1000 agentes empiezan con 1000 € y apuestan 1 € a cara o cruz en cada ronda.
El juego es justo (50/50), pero quien llega a 0 € queda fuera para siempre:
con el tiempo la mayoría se arruina y unos pocos acumulan casi todo el dinero.

Cada mono apuesta contra la banca, así que el dinero de los monos sube y baja:
el indicador **Banca** muestra en verde (▲) lo que gana la banca y en rojo (▼)
lo que pierde. La simulación arranca sola, despacio, y acelera hasta 1000
rondas por paso en unos 15 segundos. El botón ⓘ resume las reglas.

## Uso
- `index.html`: la simulación. Va en un Web Worker si se sirve por HTTP; abierta
  con `file://` corre en el hilo principal.
- `seguimiento.html`: evolución de 4 jugadores durante toda la partida.
- `monoslocal.html`: variante con 100 monos en un solo archivo.

## Archivos
- `sim.js`: simulación, umbrales de color y controlador de mensajes.
- `worker.js`: Web Worker sobre `sim.js`.
- `ui.js`: dibujo, panel de estadísticas y controles.

## Tests
```bash
node --test tests/
node tests/benchmark.js
```
