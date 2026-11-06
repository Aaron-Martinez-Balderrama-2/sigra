import os
import json
import struct
import numpy as np
from PIL import Image
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from sklearn.metrics import confusion_matrix, classification_report, accuracy_score

# Desactivar logs ruidosos de TensorFlow
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data", "dataset_documentos")
EXPORT_DIR = os.path.join(BASE_DIR, "exported")
TFJS_DIR = os.path.join(EXPORT_DIR, "cnn_tfjs")
os.makedirs(TFJS_DIR, exist_ok=True)

print("===================================================================")
print("SIGRA AI - DEEP LEARNING: CNN DE LEGIBILIDAD (KERAS + TENSORFLOW.JS)")
print("===================================================================")

IMG_SIZE = (64, 64)
CLASSES = ["ilegible", "legible"] # Indice 0: ILEGIBLE, Indice 1: LEGIBLE

def cargar_imagenes(split):
    X, y = [], []
    for idx_clase, clase in enumerate(CLASSES):
        dir_clase = os.path.join(DATA_DIR, split, clase)
        if not os.path.exists(dir_clase):
            raise FileNotFoundError(f"Carpeta no encontrada: {dir_clase}")
        for fname in sorted(os.listdir(dir_clase)):
            if fname.endswith(".png"):
                img_path = os.path.join(dir_clase, fname)
                with Image.open(img_path) as img:
                    # Convertir a escala de grises y normalizar a [0, 1]
                    gray = img.convert("L").resize(IMG_SIZE)
                    arr = np.array(gray, dtype=np.float32) / 255.0
                    X.append(arr)
                    y.append(idx_clase)
    X = np.expand_dims(np.array(X, dtype=np.float32), -1) # (N, 64, 64, 1)
    y = np.array(y, dtype=np.int32)
    return X, y

print("Cargando datasets de imagenes...")
X_train, y_train = cargar_imagenes("train")
X_test, y_test = cargar_imagenes("test")
print(f"Muestras de entrenamiento: {len(X_train)} | Muestras de prueba: {len(X_test)}")

# Construccion de la Red Neuronal Convolucional (CNN)
model = keras.Sequential([
    layers.Input(shape=(64, 64, 1), name="input_imagen"),
    layers.Conv2D(16, (3, 3), activation="relu", padding="same", name="conv1"),
    layers.MaxPooling2D((2, 2), name="pool1"),
    layers.Conv2D(32, (3, 3), activation="relu", padding="same", name="conv2"),
    layers.MaxPooling2D((2, 2), name="pool2"),
    layers.Flatten(name="flatten"),
    layers.Dense(32, activation="relu", name="dense1"),
    layers.Dropout(0.2, name="dropout"),
    layers.Dense(2, activation="softmax", name="output_clase")
], name="sigra_cnn_legibilidad")

model.compile(
    optimizer=keras.optimizers.Adam(learning_rate=0.001),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"]
)

model.summary(print_fn=lambda x: print("    " + x))

# Entrenamiento (12 epocas)
print("\n==> Iniciando entrenamiento CNN...")
history = model.fit(
    X_train, y_train,
    validation_data=(X_test, y_test),
    epochs=12,
    batch_size=16,
    verbose=1
)

# Evaluacion sobre Test Set
y_probs = model.predict(X_test)
y_preds = np.argmax(y_probs, axis=1)

acc = accuracy_score(y_test, y_preds)
cm = confusion_matrix(y_test, y_preds)
report = classification_report(y_test, y_preds, target_names=["ILEGIBLE", "LEGIBLE"], output_dict=True)

print("\n===================================================================")
print("EVALUACION FINAL CNN EN CONJUNTO DE PRUEBA INDEPENDIENTE")
print("===================================================================")
print(f"    Accuracy Global: {acc * 100:.2f}%")
print("    Matriz de Confusion:")
print(f"                 Pred Ilegible  Pred Legible")
print(f"    Real Ilegible:     {cm[0][0]:>5}         {cm[0][1]:>5}")
print(f"    Real Legible:      {cm[1][0]:>5}         {cm[1][1]:>5}")

# Guardar modelo Keras completo
keras_path = os.path.join(EXPORT_DIR, "cnn_legibilidad.keras")
model.save(keras_path)

# -----------------------------------------------------------------------------
# EXPORTACION DIRECTA AL FORMATO ESTANDAR DE TENSORFLOW.JS (model.json + .bin)
# -----------------------------------------------------------------------------
print("\n==> Exportando pesos y topologia a formato nativo TensorFlow.js...")

weights_manifest = []
weights_entries = []
binary_bytes = bytearray()

for weight_tensor in model.weights:
    w_name = weight_tensor.name
    # Limpiar nombre
    if ":0" in w_name:
        w_name = w_name.replace(":0", "")
    val = weight_tensor.numpy().astype(np.float32)
    raw = val.tobytes()
    binary_bytes.extend(raw)
    
    weights_entries.append({
        "name": w_name,
        "shape": list(val.shape),
        "dtype": "float32"
    })

bin_filename = "group1-shard1of1.bin"
bin_path = os.path.join(TFJS_DIR, bin_filename)
with open(bin_path, "wb") as f:
    f.write(binary_bytes)

# Topologia en JSON
model_json = {
    "format": "layers-model",
    "generatedBy": "keras v3",
    "convertedBy": "SIGRA Exporter (TensorFlow.js Specification)",
    "modelTopology": json.loads(model.to_json()),
    "weightsManifest": [
        {
            "paths": [bin_filename],
            "weights": weights_entries
        }
    ]
}

model_json_path = os.path.join(TFJS_DIR, "model.json")
with open(model_json_path, "w", encoding="utf-8") as f:
    json.dump(model_json, f, indent=2)

# Archivo de etiquetas y metadatos para el Frontend React
labels_path = os.path.join(TFJS_DIR, "labels.json")
with open(labels_path, "w", encoding="utf-8") as f:
    json.dump({
        "labels": ["ILEGIBLE", "LEGIBLE"],
        "inputShape": [64, 64, 1],
        "threshold": 0.5,
        "classes": {
            "0": {"id": "ILEGIBLE", "descripcion": "Documento borroso o ilegible", "valido": False},
            "1": {"id": "LEGIBLE", "descripcion": "Documento nitido y legible clasificado por CNN", "valido": True}
        }
    }, f, indent=2)

# Actualizar metricas_ml.json
metricas_path = os.path.join(EXPORT_DIR, "metricas_ml.json")
data_existente = {}
if os.path.exists(metricas_path):
    try:
        with open(metricas_path, "r", encoding="utf-8") as f:
            data_existente = json.load(f)
    except Exception:
        pass

data_existente["cnn_deep_learning"] = {
    "modelo": "CNN 2D (Keras -> TensorFlow.js)",
    "accuracy": round(float(acc), 4),
    "accuracy_porcentaje": f"{acc * 100:.2f}%",
    "clases": ["ILEGIBLE", "LEGIBLE"],
    "matriz_confusion": cm.tolist(),
    "tamano_binario_kb": round(len(binary_bytes) / 1024, 2),
    "reporte_clasificacion": {
        "ILEGIBLE": {
            "precision": round(report["ILEGIBLE"]["precision"], 4),
            "recall": round(report["ILEGIBLE"]["recall"], 4),
            "f1_score": round(report["ILEGIBLE"]["f1-score"], 4)
        },
        "LEGIBLE": {
            "precision": round(report["LEGIBLE"]["precision"], 4),
            "recall": round(report["LEGIBLE"]["recall"], 4),
            "f1_score": round(report["LEGIBLE"]["f1-score"], 4)
        }
    }
}

with open(metricas_path, "w", encoding="utf-8") as f:
    json.dump(data_existente, f, indent=2, ensure_ascii=False)

print(f"    - model.json guardado en: {model_json_path}")
print(f"    - Pesos binarios (.bin): {bin_path} ({len(binary_bytes) / 1024:.2f} KB)")
print(f"    - Labels y metadatos: {labels_path}")
print("==> ENTRENAMIENTO Y EXPORTACION CNN COMPLETADA AL 100%.")
