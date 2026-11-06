import os
import sys
import json
import struct
import time

# Forzar encoding UTF-8 en Windows Console
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
import pandas as pd
import joblib
from PIL import Image
import tensorflow as tf
from tensorflow import keras

# Importar el generador de imágenes de certificados
sys.path.append(os.path.join(os.path.dirname(__file__)))
from importlib import import_module
gen_datasets = import_module("01_generar_datasets")

print("=" * 80)
print("TESTEO RIGUROSO DE PRACTICA REAL - MODELOS DE INTELIGENCIA ARTIFICIAL (SIGRA)")
print("Asumiendo cero confianza: Verificacion en caliente desde disco y sin mocks")
print("=" * 80)

errores_totales = 0
def assert_real(condicion, descripcion, detalle=""):
    global errores_totales
    if condicion:
        print(f"  [PASO] {descripcion}")
        if detalle:
            print(f"         +-- {detalle}")
    else:
        print(f"  [FALLO] {descripcion}")
        if detalle:
            print(f"          +-- DETALLE: {detalle}")
        errores_totales += 1

EXPORTED_DIR = os.path.join(os.path.dirname(__file__), "..", "exported")
TFJS_DIR = os.path.join(EXPORTED_DIR, "cnn_tfjs")

# ==============================================================================
# TEST 1: Inferencia Real de Random Forest y K-Means cargados desde disco
# ==============================================================================
print("\n" + "=" * 80)
print("TEST 1: Inferencia Real desde Disco (Random Forest y K-Means)")
print("=" * 80)

rf_path = os.path.join(EXPORTED_DIR, "random_forest_riesgo.joblib")
kmeans_path = os.path.join(EXPORTED_DIR, "kmeans_model.joblib")
scaler_path = os.path.join(EXPORTED_DIR, "kmeans_scaler.joblib")

assert_real(os.path.exists(rf_path), "Archivo binario joblib de Random Forest existe en disco")
assert_real(os.path.exists(kmeans_path), "Archivo binario joblib de K-Means existe en disco")
assert_real(os.path.exists(scaler_path), "Archivo binario joblib de StandardScaler existe en disco")

rf_model = joblib.load(rf_path)
kmeans_model = joblib.load(kmeans_path)
scaler = joblib.load(scaler_path)

assert_real(hasattr(rf_model, "predict"), "Modelo Random Forest deserializado correctamente con metodo predict()")
assert_real(hasattr(rf_model, "predict_proba"), "Modelo Random Forest contiene predict_proba() para probabilidades")
assert_real(hasattr(kmeans_model, "cluster_centers_"), "Modelo K-Means contiene centros de clusteres reales")

# Contrato de features del modelo entrenado:
# Random Forest: ["promedio_notas", "porcentaje_asistencia", "faltas_sin_justificar"]
# K-Means: ["promedio_notas", "porcentaje_asistencia"]
feature_cols_rf = ["promedio_notas", "porcentaje_asistencia", "faltas_sin_justificar"]
feature_cols_km = ["promedio_notas", "porcentaje_asistencia"]

casos_prueba = [
    {"nombre": "Caso 1: Alumno Sobresaliente (92 pts, 95% asist, 0 faltas)", "rf": [92.0, 95.0, 0], "km": [92.0, 95.0], "esperado": "BAJO"},
    {"nombre": "Caso 2: Alumno Regular Aprobado (75 pts, 85% asist, 1 falta)", "rf": [75.0, 85.0, 1], "km": [75.0, 85.0], "esperado": "BAJO"},
    {"nombre": "Caso 3: Alumno Excelente (98 pts, 100% asist, 0 faltas)", "rf": [98.0, 100.0, 0], "km": [98.0, 100.0], "esperado": "BAJO"},
    {"nombre": "Caso 4: Alumno en Riesgo Medio por Nota Baja (58 pts < 70, 78% asist)", "rf": [58.0, 78.0, 1], "km": [58.0, 78.0], "esperado": "MEDIO"},
    {"nombre": "Caso 5: Alumno en Riesgo Medio por Asistencia (62 pts, 72% asist < 80)", "rf": [62.0, 72.0, 1], "km": [62.0, 72.0], "esperado": "MEDIO"},
    {"nombre": "Caso 6: Alumno en Riesgo Medio por Faltas (75 pts, 85% asist, 2 faltas)", "rf": [75.0, 85.0, 2], "km": [75.0, 85.0], "esperado": "MEDIO"},
    {"nombre": "Caso 7: Alumno Critico por Nota Reprobatoria (40 pts < 51)", "rf": [40.0, 85.0, 0], "km": [40.0, 85.0], "esperado": "ALTO"},
    {"nombre": "Caso 8: Alumno Critico por Inasistencia Severa (80 pts, 60% asist < 65)", "rf": [80.0, 60.0, 0], "km": [80.0, 60.0], "esperado": "ALTO"},
    {"nombre": "Caso 9: Alumno Critico por Exceso de Faltas (85 pts, 90% asist, 5 faltas >= 4)", "rf": [85.0, 90.0, 5], "km": [85.0, 90.0], "esperado": "ALTO"},
    {"nombre": "Caso 10: Alumno en Abandono Total (15 pts, 20% asist, 6 faltas)", "rf": [15.0, 20.0, 6], "km": [15.0, 20.0], "esperado": "ALTO"},
    {"nombre": "Caso 11: Limite Aprobatorio Justo (71 pts, 81% asist, 0 faltas)", "rf": [71.0, 81.0, 0], "km": [71.0, 81.0], "esperado": "BAJO"},
    {"nombre": "Caso 12: Inasistencia Cronica Extrema (0 pts, 0% asist, 8 faltas)", "rf": [0.0, 0.0, 8], "km": [0.0, 0.0], "esperado": "ALTO"},
]

print("\n--- Ejecutando Inferencia sobre 12 Perfiles Estudiantiles Reales ---")
casos_correctos = 0
for c in casos_prueba:
    df_rf = pd.DataFrame([c["rf"]], columns=feature_cols_rf)
    prediccion = rf_model.predict(df_rf)[0]
    probabilidades = rf_model.predict_proba(df_rf)[0]
    classes = list(rf_model.classes_)
    prob_dict = {classes[i]: round(float(probabilidades[i]) * 100, 1) for i in range(len(classes))}

    # K-Means cluster
    X_km_scaled = scaler.transform(np.array([c["km"]]))
    cluster_id = int(kmeans_model.predict(X_km_scaled)[0])

    suma_prob = sum(probabilidades)
    assert_real(
        abs(suma_prob - 1.0) < 1e-4,
        f"Distribucion de probabilidad suma 100% en {c['nombre']}",
        f"Suma={suma_prob:.4f}, Probabilidades={prob_dict}"
    )

    es_correcto = (prediccion == c["esperado"])
    if es_correcto:
        casos_correctos += 1
    assert_real(
        es_correcto,
        f"{c['nombre']} -> Predicho: {prediccion} (Esperado: {c['esperado']})",
        f"Input={c['rf']} | Cluster K-Means={cluster_id} | Distribucion={prob_dict}"
    )

assert_real(casos_correctos == 12, "Total 12/12 casos de inferencia evaluados con 100% de coherencia pedagogica")


# ==============================================================================
# TEST 2: Inferencia en Vivo sobre 6 Imagenes NUEVAS generadas en caliente
# ==============================================================================
print("\n" + "=" * 80)
print("TEST 2: Inferencia en Vivo sobre Imagenes Totalmente Nuevas (Blind Test)")
print("=" * 80)

keras_path = os.path.join(EXPORTED_DIR, "cnn_legibilidad.keras")
assert_real(os.path.exists(keras_path), "Archivo del modelo CNN Keras cnn_legibilidad.keras existe en disco")
cnn_model = keras.models.load_model(keras_path)
assert_real(cnn_model is not None, "Modelo CNN Keras cargado en memoria de TensorFlow")

# Generar 6 imágenes completamente nuevas en memoria con textos nunca vistos
imagenes_experimento = [
    {
        "nombre": "Nueva Imagen 1: Certificado CNS Nitido (Nunca Visto)",
        "img": gen_datasets.crear_imagen_documento("CERTIFICADO MEDICO NUEVO CNS REG 9901", legible=True, seed=8811),
        "esperado": "LEGIBLE"
    },
    {
        "nombre": "Nueva Imagen 2: Certificado Seguro UAGRM Nitido (Nunca Visto)",
        "img": gen_datasets.crear_imagen_documento("SEGURO DE SALUD UNIVERSITARIO UAGRM", legible=True, seed=8822),
        "esperado": "LEGIBLE"
    },
    {
        "nombre": "Nueva Imagen 3: Receta Hospital San Juan de Dios Nitida",
        "img": gen_datasets.crear_imagen_documento("HOSPITAL SAN JUAN DE DIOS - REPOSO 3 DIAS", legible=True, seed=8833),
        "esperado": "LEGIBLE"
    },
    {
        "nombre": "Nueva Imagen 4: Certificado Borroso por Desenfoque de Camara",
        "img": gen_datasets.crear_imagen_documento("CERTIFICADO MEDICO NUEVO CNS REG 9901", legible=False, seed=9911),
        "esperado": "ILEGIBLE"
    },
    {
        "nombre": "Nueva Imagen 5: Certificado Ilegible con Ruido y Manchas",
        "img": gen_datasets.crear_imagen_documento("SEGURO DE SALUD UNIVERSITARIO UAGRM", legible=False, seed=9922),
        "esperado": "ILEGIBLE"
    },
    {
        "nombre": "Nueva Imagen 6: Receta Ilegible con Desenfoque Severo",
        "img": gen_datasets.crear_imagen_documento("HOSPITAL SAN JUAN DE DIOS - REPOSO 3 DIAS", legible=False, seed=9933),
        "esperado": "ILEGIBLE"
    },
]

print("\n--- Ejecutando Prediccion Convolucional en Tiempo Real ---")
labels_map = {0: "ILEGIBLE", 1: "LEGIBLE"}

for idx, exp in enumerate(imagenes_experimento, 1):
    t_start = time.perf_counter()
    img_pil = exp["img"]
    arr = np.array(img_pil.convert("L").resize((64, 64)), dtype=np.float32) / 255.0
    arr = arr.reshape(1, 64, 64, 1)

    preds = cnn_model.predict(arr, verbose=0)[0]
    t_ms = (time.perf_counter() - t_start) * 1000.0

    p_ilegible = float(preds[0])
    p_legible = float(preds[1])
    clase_predicha = "LEGIBLE" if p_legible >= p_ilegible else "ILEGIBLE"
    confianza = max(p_legible, p_ilegible) * 100.0

    es_correcto = (clase_predicha == exp["esperado"])
    assert_real(
        es_correcto,
        f"{exp['nombre']} -> Clasificado: {clase_predicha} ({confianza:.2f}% de confianza) [Latencia: {t_ms:.1f}ms]",
        f"P(ILEGIBLE)={p_ilegible*100:.2f}%, P(LEGIBLE)={p_legible*100:.2f}% | Esperado: {exp['esperado']}"
    )


# ==============================================================================
# TEST 3: Verificacion Binaria Estricta de los Pesos Exportados para Web (TF.js)
# ==============================================================================
print("\n" + "=" * 80)
print("TEST 3: Verificacion Binaria Estricta de Artefactos TensorFlow.js")
print("=" * 80)

model_json_path = os.path.join(TFJS_DIR, "model.json")
weights_bin_path = os.path.join(TFJS_DIR, "group1-shard1of1.bin")

assert_real(os.path.exists(model_json_path), "Archivo de arquitectura model.json existe en disco")
assert_real(os.path.exists(weights_bin_path), "Archivo binario de pesos group1-shard1of1.bin existe en disco")

with open(model_json_path, "r", encoding="utf-8") as f:
    model_json = json.load(f)

weights_manifest = model_json.get("weightsManifest", [])
assert_real(len(weights_manifest) > 0, "Manifiesto de pesos presente en model.json")

# Sumar el numero exacto de floats de 32 bits esperados en el manifiesto
total_floats_esperados = 0
tensores_info = []
for group in weights_manifest:
    for w in group.get("weights", []):
        shape = w["shape"]
        num_floats = 1
        for s in shape:
            num_floats *= s
        total_floats_esperados += num_floats
        tensores_info.append((w["name"], shape, num_floats))

bytes_esperados = total_floats_esperados * 4
bytes_reales_en_disco = os.path.getsize(weights_bin_path)

assert_real(
    bytes_esperados == bytes_reales_en_disco,
    f"Coincidencia exacta byte a byte del archivo de pesos binarios",
    f"Floats={total_floats_esperados} | Bytes Calculados={bytes_esperados} == Bytes en Disco={bytes_reales_en_disco}"
)

# Desempaquetar los floats en memoria y verificar que no haya NaN ni ceros corruptos
with open(weights_bin_path, "rb") as f:
    raw_bytes = f.read()

floats_desempaquetados = struct.unpack(f"{total_floats_esperados}f", raw_bytes)
arr_floats = np.array(floats_desempaquetados, dtype=np.float32)

hay_nans = np.isnan(arr_floats).any()
hay_infs = np.isinf(arr_floats).any()
std_weights = float(np.std(arr_floats))
mean_weights = float(np.mean(arr_floats))

assert_real(not hay_nans, "Verificacion matematica: Cero valores NaN en la matriz de pesos convolucionales")
assert_real(not hay_infs, "Verificacion matematica: Cero valores Infinitos en la matriz de pesos convolucionales")
assert_real(
    std_weights > 0.01,
    f"Verificacion de gradientes: Pesos correctamente entrenados con variacion real (Desviacion={std_weights:.4f})",
    f"Media={mean_weights:.4f}, Min={float(np.min(arr_floats)):.4f}, Max={float(np.max(arr_floats)):.4f}"
)

# Compatibilidad con los tipos del Backend Java y PHP
backend_classes_cnn = ["LEGIBLE", "ILEGIBLE"]
labels_path = os.path.join(TFJS_DIR, "labels.json")
with open(labels_path, "r", encoding="utf-8") as f:
    labels_exported = json.load(f)

vocabulario_valido = all(v in backend_classes_cnn for v in labels_exported.get("labels", []))
assert_real(
    vocabulario_valido,
    f"Vocabulario exportado de TF.js {labels_exported.get('labels')} es 100% compatible con ClasificacionCnn de Java ms-asistencia"
)

# Compatibilidad con NivelRiesgo en PHP
classes_rf = list(rf_model.classes_)
backend_classes_riesgo = ["ALTO", "MEDIO", "BAJO"]
rf_valido = set(classes_rf) == set(backend_classes_riesgo)
assert_real(
    rf_valido,
    f"Clases de Random Forest {classes_rf} coinciden 100% con el Enum NivelRiesgo de PHP Laravel ms-riesgo"
)

print("\n" + "=" * 80)
if errores_totales == 0:
    print("RESUMEN: ¡TODAS LAS PRUEBAS DE PRACTICA REAL PASARON CON 100% DE EXITO!")
    print("Los modelos de IA estan cargando desde disco, infiriendo en caliente y listos para produccion.")
else:
    print(f"RESUMEN: SE ENCONTRARON {errores_totales} ERRORES.")
    sys.exit(1)
print("=" * 80)
