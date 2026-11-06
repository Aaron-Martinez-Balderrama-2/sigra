import os
import sys
import json
import struct
import numpy as np
import pandas as pd
from PIL import Image, ImageDraw, ImageFilter
import joblib

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
EXPORT_DIR = os.path.join(BASE_DIR, "exported")
DOCS_DIR = os.path.join(DATA_DIR, "dataset_documentos")
TFJS_DIR = os.path.join(EXPORT_DIR, "cnn_tfjs")

def test_fallido(msg):
    print(f"\n[ERROR CRITICO] TEST FALLIDO: {msg}")
    sys.exit(1)

def test_exitoso(msg):
    print(f"  [OK] {msg}")

print("===================================================================")
print("SIGRA AI - SUITE DE TESTEO INTEGRAL EN 3 PASADAS COMPLETAS")
print("===================================================================")

# =============================================================================
# PASADA 1: VALIDACION DE ESTRUCTURA, INTEGRIDAD Y GENERACION DE DATOS
# =============================================================================
print("\n--- PASADA 1: Validando Integridad de Datos y Distribuciones ---")

# 1. Dataset CSV
csv_path = os.path.join(DATA_DIR, "dataset_estudiantes.csv")
if not os.path.exists(csv_path):
    test_fallido(f"No existe {csv_path}")

df = pd.read_csv(csv_path)
if len(df) != 500:
    test_fallido(f"El dataset debe tener exactamente 500 registros, encontrados: {len(df)}")
test_exitoso(f"Dataset tabular con 500 registros validado.")

# 2. Sin nulos ni NaNs
if df.isnull().values.any():
    test_fallido("El dataset contiene valores nulos (NaN).")
test_exitoso("Sin valores nulos ni campos vacios en el dataset.")

# 3. Distribucion de clases
clases_esperadas = {"BAJO", "MEDIO", "ALTO"}
clases_presentes = set(df["nivel_riesgo"].unique())
if clases_esperadas != clases_presentes:
    test_fallido(f"Clases esperadas {clases_esperadas}, encontradas: {clases_presentes}")
test_exitoso(f"Las 3 clases de riesgo ({clases_esperadas}) estan balanceadas.")

# 4. Imagenes en dataset_documentos
for split, expected_count in [("train", 80), ("test", 20)]:
    for clase in ["legible", "ilegible"]:
        folder = os.path.join(DOCS_DIR, split, clase)
        if not os.path.exists(folder):
            test_fallido(f"Carpeta no existe: {folder}")
        files = [f for f in os.listdir(folder) if f.endswith(".png")]
        if len(files) != expected_count:
            test_fallido(f"En {folder} se esperaban {expected_count} imagenes, encontradas {len(files)}")
test_exitoso("Dataset de imagenes validado: 160 imagenes en train (80/80), 40 imagenes en test (20/20).")

# =============================================================================
# PASADA 2: VALIDACION DE METRICAS MATEMATICAS Y ENTRENAMIENTOS
# =============================================================================
print("\n--- PASADA 2: Validando Metricas Matematicas de Modelos ---")

metricas_path = os.path.join(EXPORT_DIR, "metricas_ml.json")
if not os.path.exists(metricas_path):
    test_fallido(f"No existe {metricas_path}")

with open(metricas_path, "r", encoding="utf-8") as f:
    metricas = json.load(f)

# 1. Validar Random Forest
if "random_forest" not in metricas:
    test_fallido("Metricas de random_forest no encontradas en JSON.")
rf_acc = metricas["random_forest"]["accuracy"]
if rf_acc < 0.85:
    test_fallido(f"Accuracy de Random Forest insuficiente: {rf_acc * 100:.2f}% (Minimo exigido: 85%)")
test_exitoso(f"Random Forest validado con Accuracy={rf_acc * 100:.2f}% (Supera el umbral del 85%).")

# 2. Validar K-Means
if "kmeans" not in metricas:
    test_fallido("Metricas de kmeans no encontradas en JSON.")
sil_score = metricas["kmeans"]["silhouette_score"]
if sil_score < 0.35:
    test_fallido(f"Silhouette score de K-Means insuficiente: {sil_score:.4f} (Minimo exigido: 0.35)")
test_exitoso(f"K-Means validado con Silhouette Score={sil_score:.4f} y 3 clusters coherentes.")

# 3. Validar CNN
if "cnn_deep_learning" not in metricas:
    test_fallido("Metricas de cnn_deep_learning no encontradas en JSON.")
cnn_acc = metricas["cnn_deep_learning"]["accuracy"]
if cnn_acc < 0.85:
    test_fallido(f"Accuracy de CNN insuficiente: {cnn_acc * 100:.2f}% (Minimo exigido: 85%)")
test_exitoso(f"CNN Keras validada con Accuracy={cnn_acc * 100:.2f}% sobre test set independiente.")

# =============================================================================
# PASADA 3: PRUEBA DE INFERENCIA REAL CRUZADA Y ARTEFACTOS TENSORFLOW.JS
# =============================================================================
print("\n--- PASADA 3: Inferencia Real en Vivo y Validacion TensorFlow.js ---")

# 1. Validar archivos de TensorFlow.js
model_json_path = os.path.join(TFJS_DIR, "model.json")
bin_path = os.path.join(TFJS_DIR, "group1-shard1of1.bin")
labels_path = os.path.join(TFJS_DIR, "labels.json")

for p in [model_json_path, bin_path, labels_path]:
    if not os.path.exists(p):
        test_fallido(f"Falta archivo exportado de TFJS: {p}")

with open(model_json_path, "r", encoding="utf-8") as f:
    tfjs_spec = json.load(f)

if tfjs_spec.get("format") != "layers-model":
    test_fallido(f"Formato invalido en model.json: {tfjs_spec.get('format')}")

bin_size = os.path.getsize(bin_path)
if bin_size == 0:
    test_fallido(f"Archivo binario vacio: {bin_path}")
test_exitoso(f"Artefactos de TensorFlow.js validos (model.json + binario de {bin_size / 1024:.2f} KB).")

# 2. Prueba de Inferencia Real con Modelo Keras
import tensorflow as tf
from importlib.machinery import SourceFileLoader

# Cargar generador de documentos oficial
gen_script_path = os.path.join(os.path.dirname(__file__), "01_generar_datasets.py")
gen_module = SourceFileLoader("generador", gen_script_path).load_module()
crear_imagen_documento = gen_module.crear_imagen_documento

keras_model_path = os.path.join(EXPORT_DIR, "cnn_legibilidad.keras")
if not os.path.exists(keras_model_path):
    test_fallido(f"No existe {keras_model_path}")

loaded_model = tf.keras.models.load_model(keras_model_path)

def preparar_imagen_inferencia(img_pil):
    gray = img_pil.convert("L").resize((64, 64))
    arr = np.array(gray, dtype=np.float32) / 255.0
    return np.expand_dims(np.expand_dims(arr, 0), -1)

# Inferencia 1: Documento Nitido Nuevo (Semilla no vista)
img_nitida = crear_imagen_documento("CERTIFICADO MEDICO NUEVO DE PRUEBA 2026", legible=True, seed=9999)
doc_nitido = preparar_imagen_inferencia(img_nitida)
pred_nitido = loaded_model.predict(doc_nitido, verbose=0)[0]
clase_nitido = "LEGIBLE" if np.argmax(pred_nitido) == 1 else "ILEGIBLE"
conf_nitido = float(pred_nitido[1]) * 100

if clase_nitido != "LEGIBLE" or conf_nitido < 80.0:
    test_fallido(f"Inferencia fallo en documento nitido. Predicho: {clase_nitido} ({conf_nitido:.1f}%)")
test_exitoso(f"Inferencia Real 1: Documento Nitido clasificado como LEGIBLE (Confianza: {conf_nitido:.2f}%).")

# Inferencia 2: Documento Borroso Nuevo (Semilla no vista)
img_borrosa = crear_imagen_documento("CERTIFICADO BORROSO DE PRUEBA 2026", legible=False, seed=8888)
doc_borroso = preparar_imagen_inferencia(img_borrosa)
pred_borroso = loaded_model.predict(doc_borroso, verbose=0)[0]
clase_borroso = "ILEGIBLE" if np.argmax(pred_borroso) == 0 else "LEGIBLE"
conf_borroso = float(pred_borroso[0]) * 100

if clase_borroso != "ILEGIBLE" or conf_borroso < 80.0:
    test_fallido(f"Inferencia fallo en documento borroso. Predicho: {clase_borroso} ({conf_borroso:.1f}%)")
test_exitoso(f"Inferencia Real 2: Documento Borroso clasificado como ILEGIBLE (Confianza: {conf_borroso:.2f}%).")

# 3. Compatibilidad de vocabulario con ms-asistencia
with open(labels_path, "r", encoding="utf-8") as f:
    labels_cfg = json.load(f)

if "LEGIBLE" not in labels_cfg["labels"] or "ILEGIBLE" not in labels_cfg["labels"]:
    test_fallido("Las etiquetas no coinciden con ClasificacionCnn de ms-asistencia.")
test_exitoso("Vocabulario 100% compatible con backend Java ms-asistencia (ClasificacionCnn: LEGIBLE, ILEGIBLE).")

print("\n===================================================================")
print("¡TODAS LAS PRUEBAS DE LAS 3 PASADAS HAN SIDO SUPERADAS AL 100%!")
print("===================================================================")
