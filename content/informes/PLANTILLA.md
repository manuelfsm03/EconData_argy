---
anio: 2026
semana: 42
fecha_corte: 2026-10-16
titulo:
---

<!--
PLANTILLA del informe semanal de La Pizarra.

CÓMO USARLA
1. Copiá este archivo a content/informes/<AAAA>-S<semana>.md  (ej: 2026-S42.md).
2. Completá el frontmatter: anio, semana (1 a 53) y fecha_corte (AAAA-MM-DD).
   "titulo" es opcional: una frase con la tesis de la semana.
3. Escribí el texto de cada sección debajo de su encabezado. Si una sección queda
   vacía (o solo con comentarios como este), la página muestra el gráfico solo.
   Nunca se rellena con texto automático.
4. No cambies los encabezados: tienen que ser exactamente estos cinco ids y en
   minúscula (deuda-usd, credito, deuda-pesos, tipo-de-cambio, reservas).
   Un encabezado que no sea uno de esos se ignora.
5. Abrí /informe?semana=<AAAA>-S<semana> para verlo; Imprimir -> Guardar como PDF
   da el A4.

QUÉ ESCRIBIR (formato 1816: 2 a 4 oraciones por sección, 5 como máximo)
- Primera oración: la lectura de la semana, con el número que la sostiene.
- Segunda: por qué importa (qué cambia para el inversor o para el Tesoro).
- Tercera (opcional): qué mirar la semana próxima.
- Todo número que escribas tiene que poder rastrearse al gráfico que está al lado
  o a su fuente. Si no lo podés verificar, no lo escribas. Un claim más débil pero
  verdadero gana siempre.
- Texto plano. Se admiten párrafos separados por una línea en blanco y listas con
  "- ". No uses HTML ni emojis.

ESTE TEXTO ES ESCRITO A MANO POR EL EQUIPO. No lo genera ninguna IA: después sirve
como ejemplos de criterio para entrenar al agente financiero.
-->

## deuda-usd

<!-- Riesgo país (EMBI+), TIR de los Globales, deuda pública sobre PIB.
     Qué decir: nivel y variación del riesgo país, qué pasó con la curva de Globales,
     si hubo noticia de deuda o canje. -->

## credito

<!-- Depósitos, tasas de depósitos (TAMAR, BADLAR) y morosidad (cuando entre la rama).
     Qué decir: si la tasa sube o baja, si los depósitos a plazo ganan o pierden
     frente a los de la vista, cómo se mueve la mora. -->

## deuda-pesos

<!-- Curva LECAP/BONCAP, CER y duales, últimas licitaciones del Tesoro.
     Qué decir: qué rinde la curva a tasa fija, cómo se posiciona el CER, cuánto
     rolló el Tesoro en la última licitación y con qué cobertura. -->

## tipo-de-cambio

<!-- Oficial, MEP, CCL y blue; bandas cambiarias; balance cambiario (cuando entre la rama).
     Qué decir: brecha, distancia del oficial al techo/piso de la banda, qué se
     espera de la cobertura. -->

## reservas

<!-- Reservas brutas y netas, compras de divisas del BCRA, REPO (cuando entre la rama).
     Qué decir: cuánto compró el BCRA en la semana y en el mes, variación de brutas,
     qué explica el movimiento (compras, pagos, valuación). -->
