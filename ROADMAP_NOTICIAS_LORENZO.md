# Cargar los datos (si no los tienes cargados)
# DATOS <- datos_cobre  # Si usaste mi código anterior

# Verificar la estructura de los datos
str(DATOS)
summary(DATOS)

# 1. Primero, limpiar los datos y manejar valores problemáticos
# Identificar filas con valores válidos para todas las variables
# (valores positivos para poder calcular logaritmos)

# Crear una copia de trabajo
datos_trabajo <- DATOS

# Ver valores cero o negativos en las variables que usaremos
cat("Valores en I (producción industrial):\n")
print(datos_trabajo$I)
cat("\nValores en L (precio Londres):\n")
print(datos_trabajo$L)
cat("\nValores en H (viviendas):\n")
print(datos_trabajo$H)
cat("\nValores en A (aluminio):\n")
print(datos_trabajo$A)

# 2. Filtrar solo filas con valores válidos para todas las variables
# (mayores que 0 y no NA)
datos_validos <- datos_trabajo[
  datos_trabajo$I > 0 & 
  datos_trabajo$L > 0 & 
  datos_trabajo$H > 0 & 
  !is.na(datos_trabajo$A) & 
  datos_trabajo$A > 0, 
]

cat("\nNúmero de observaciones válidas:", nrow(datos_validos), "\n")
cat("Años incluidos:\n")
print(datos_validos$ANO)

# 3. Calcular los logaritmos
Y <- log(datos_validos$C)  # Variable dependiente: log(Precio cobre US)

# Crear matriz de diseño con intercepto
X <- cbind(1,  # intercepto (columna de unos)
           log(datos_validos$I),  # log(Producción industrial)
           log(datos_validos$L),  # log(Precio cobre Londres)
           log(datos_validos$H),  # log(Viviendas)
           log(datos_validos$A))  # log(Precio aluminio)

# Asignar nombres a las columnas
colnames(X) <- c("Intercepto", "log_I", "log_L", "log_H", "log_A")

# 4. Estimar los betas usando la fórmula de mínimos cuadrados
# beta = (X'X)^(-1) X'Y
beta <- solve(t(X) %*% X) %*% (t(X) %*% Y)

# Mostrar resultados
cat("\n=== ESTIMACIÓN DE COEFICIENTES BETA ===\n")
print(beta)

# 5. Calcular valores predichos y residuos
Y_pred <- X %*% beta
residuos <- Y - Y_pred

# 6. Calcular estadísticos adicionales
n <- nrow(X)  # número de observaciones
k <- ncol(X) - 1  # número de variables independientes (sin contar intercepto)

# Varianza del error (sigma^2)
sigma2 <- sum(residuos^2) / (n - k - 1)

# Matriz de varianza-covarianza de los coeficientes
var_beta <- sigma2 * solve(t(X) %*% X)

# Errores estándar
errores_estandar <- sqrt(diag(var_beta))

# Estadístico t
t_estadistico <- beta / errores_estandar

# P-valores (aproximados, asumiendo distribución t)
p_valores <- 2 * (1 - pt(abs(t_estadistico), df = n - k - 1))

# 7. Crear tabla completa de resultados
resultados <- data.frame(
  Coeficiente = round(beta, 4),
  Error_Est = round(errores_estandar, 4),
  t_estadistico = round(t_estadistico, 4),
  p_valor = round(p_valores, 4)
)

# Formatear p-valores pequeños
resultados$p_valor <- ifelse(resultados$p_valor < 0.0001, "< 0.0001", resultados$p_valor)

cat("\n=== RESULTADOS COMPLETOS DE LA REGRESIÓN ===\n")
print(resultados)

# 8. Calcular R-cuadrado
SST <- sum((Y - mean(Y))^2)  # Suma de cuadrados total
SSE <- sum(residuos^2)        # Suma de cuadrados del error
SSR <- SST - SSE              # Suma de cuadrados de la regresión

R2 <- 1 - SSE/SST
R2_ajustado <- 1 - (1-R2)*(n-1)/(n-k-1)

cat("\n=== MEDIDAS DE BONDAD DE AJUSTE ===\n")
cat("R-cuadrado (R²):", round(R2, 4), "\n")
cat("R-cuadrado ajustado:", round(R2_ajustado, 4), "\n")
cat("Error estándar de la regresión (sigma):", round(sqrt(sigma2), 4), "\n")

# 9. Comparación con la función lm() de R (para verificar)
cat("\n=== VERIFICACIÓN CON lm() ===\n")
modelo_lm <- lm(log(C) ~ log(I) + log(L) + log(H) + log(A), data = datos_validos)
summary(modelo_lm)

# 10. Intervalos de confianza al 95%
cat("\n=== INTERVALOS DE CONFIANZA AL 95% ===\n")
alpha <- 0.05
t_critico <- qt(1 - alpha/2, df = n - k - 1)

intervalos <- data.frame(
  Coeficiente = beta,
  LI = beta - t_critico * errores_estandar,
  LS = beta + t_critico * errores_estandar
)
print(round(intervalos, 4))

# 11. Matriz de correlaciones de las variables en log
cat("\n=== MATRIZ DE CORRELACIONES (variables en log) ===\n")
datos_log <- data.frame(
  log_C = Y,
  log_I = log(datos_validos$I),
  log_L = log(datos_validos$L),
  log_H = log(datos_validos$H),
  log_A = log(datos_validos$A)
)
print(round(cor(datos_log), 4))

# 12. Prueba de multicolinealidad (VIF)
cat("\n=== FACTOR DE INFLACIÓN DE LA VARIANZA (VIF) ===\n")
if(require(car, quietly = TRUE)) {
  vif_values <- vif(modelo_lm)
  print(vif_values)
} else {
  cat("Instala el paquete 'car' para calcular VIF: install.packages('car')\n")
}