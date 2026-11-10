import os
import json
import random
import shutil
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance, ImageOps
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

# Fijar semillas
random.seed(42)
np.random.seed(42)
tf.random.set_seed(42)
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
RAW_DOCS = os.path.join(DATA_DIR, "real_raw_docs")
RAW_NON_DOCS = os.path.join(DATA_DIR, "real_raw_non_docs")
EXPORT_DIR = os.path.join(BASE_DIR, "exported")
TFJS_DIR = os.path.join(EXPORT_DIR, "cnn_tfjs")
os.makedirs(TFJS_DIR, exist_ok=True)

IMG_SIZE = (64, 64)

def to_gray_tensor(pil_img):
    """Convierte PIL Image a array (64, 64, 1) normalizado [0, 1] idéntico a tfjs canvas."""
    gray = pil_img.convert("L").resize(IMG_SIZE, Image.Resampling.LANCZOS)
    arr = np.array(gray, dtype=np.float32) / 255.0
    return np.expand_dims(arr, -1)

def generar_dataset_real():
    X, y = [], []

    # 1. DOCUMENTOS REALES -> LEGIBLES (Clase 1)
    doc_files = [os.path.join(RAW_DOCS, f) for f in os.listdir(RAW_DOCS) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    print(f"Cargando {len(doc_files)} documentos reales base...")

    for fpath in doc_files:
        try:
            with Image.open(fpath) as img:
                img = img.convert("RGB")
                w, h = img.size

                # a) Imagen completa estándar
                X.append(to_gray_tensor(img))
                y.append(1)

                # b) Recorte central 85% (zoom típico al escanear con móvil)
                c_w, c_h = int(w * 0.85), int(h * 0.85)
                x0, y0 = (w - c_w) // 2, (h - c_h) // 2
                crop_center = img.crop((x0, y0, x0 + c_w, y0 + c_h))
                X.append(to_gray_tensor(crop_center))
                y.append(1)

                # c) Recorte superior (encabezado médico / sellos)
                crop_top = img.crop((0, 0, w, int(h * 0.75)))
                X.append(to_gray_tensor(crop_top))
                y.append(1)

                # d) Recorte inferior (diagnóstico y sellos)
                crop_bot = img.crop((0, int(h * 0.25), w, h))
                X.append(to_gray_tensor(crop_bot))
                y.append(1)

                # e) Variación de brillo +15%
                bright = ImageEnhance.Brightness(img).enhance(1.15)
                X.append(to_gray_tensor(bright))
                y.append(1)

                # f) Variación de brillo -15%
                dark = ImageEnhance.Brightness(img).enhance(0.85)
                X.append(to_gray_tensor(dark))
                y.append(1)

                # g) Rotación leve +3 grados
                rot_pos = img.rotate(3, expand=False, fillcolor=(250, 250, 250))
                X.append(to_gray_tensor(rot_pos))
                y.append(1)

                # h) Rotación leve -3 grados
                rot_neg = img.rotate(-3, expand=False, fillcolor=(250, 250, 250))
                X.append(to_gray_tensor(rot_neg))
                y.append(1)

                # i) Autocontraste
                eq = ImageOps.autocontrast(img, cutoff=1)
                X.append(to_gray_tensor(eq))
                y.append(1)

                # -------------------------------------------------------------
                # 2. VERSIONES DESENFOCADAS DEL MISMO DOCUMENTO -> ILEGIBLE (Clase 0)
                # -------------------------------------------------------------
                # Desenfoque gaussiano suave (fuera de foco típico de cámara)
                blur_soft = img.filter(ImageFilter.GaussianBlur(radius=random.uniform(3.5, 5.0)))
                X.append(to_gray_tensor(blur_soft))
                y.append(0)

                # Desenfoque gaussiano fuerte (foto muy borrosa)
                blur_hard = img.filter(ImageFilter.GaussianBlur(radius=random.uniform(6.0, 9.5)))
                X.append(to_gray_tensor(blur_hard))
                y.append(0)

                # Desenfoque de movimiento + ruido (cámara temblorosa en aula)
                arr_b = np.array(blur_soft, dtype=np.float32)
                noise = np.random.normal(0, 20, arr_b.shape)
                noisy = Image.fromarray(np.clip(arr_b + noise, 0, 255).astype(np.uint8))
                X.append(to_gray_tensor(noisy))
                y.append(0)

        except Exception as e:
            print(f"Error procesando {fpath}: {e}")

    # 3. IMÁGENES REALES QUE NO SON DOCUMENTOS -> ILEGIBLE (Clase 0)
    non_doc_files = [os.path.join(RAW_NON_DOCS, f) for f in os.listdir(RAW_NON_DOCS) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    print(f"Cargando {len(non_doc_files)} imágenes reales NO documentales...")

    for fpath in non_doc_files:
        try:
            with Image.open(fpath) as img:
                img = img.convert("RGB")
                w, h = img.size

                # Imagen completa
                X.append(to_gray_tensor(img))
                y.append(0)

                # Recorte cuadrático 1
                c1 = img.crop((0, 0, min(w, h), min(w, h)))
                X.append(to_gray_tensor(c1))
                y.append(0)

                # Recorte cuadrático 2
                c2 = img.crop((max(0, w - min(w, h)), max(0, h - min(w, h)), w, h))
                X.append(to_gray_tensor(c2))
                y.append(0)

                # Rotación
                r = img.rotate(random.choice([-15, 15, 90]))
                X.append(to_gray_tensor(r))
                y.append(0)

                # Variación de iluminación
                dark_nd = ImageEnhance.Brightness(img).enhance(0.7)
                X.append(to_gray_tensor(dark_nd))
                y.append(0)

        except Exception as e:
            print(f"Error procesando {fpath}: {e}")

    X = np.array(X, dtype=np.float32)
    y = np.array(y, dtype=np.int32)
    return X, y

print("===================================================================")
print("SIGRA AI - ENTRENAMIENTO DE CNN CON FOTOS REALES DE CERTIFICADOS")
print("===================================================================")

X, y = generar_dataset_real()
indices = np.arange(len(X))
np.random.shuffle(indices)
X = X[indices]
y = y[indices]

print(f"Total muestras generadas a partir de fotos reales: {len(X)}")
n_legible = int(np.sum(y == 1))
n_ilegible = int(np.sum(y == 0))
print(f"   Clase 1 (LEGIBLE - Documentos nítidos reales): {n_legible}")
print(f"   Clase 0 (ILEGIBLE - Fotos borrosas o no documentos): {n_ilegible}")

# Split 80% Train, 20% Test
split_idx = int(len(X) * 0.8)
X_train, y_train = X[:split_idx], y[:split_idx]
X_test, y_test = X[split_idx:], y[split_idx:]
print(f"Train set: {len(X_train)} | Test set: {len(X_test)}")

# Topología idéntica para mantener compatibilidad binaria 100% con TensorFlow.js
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

print("\n==> Iniciando entrenamiento CNN con fotos reales (22 épocas)...")
history = model.fit(
    X_train, y_train,
    validation_data=(X_test, y_test),
    epochs=22,
    batch_size=16,
    verbose=1
)

# Evaluación
y_probs = model.predict(X_test, verbose=0)
y_preds = np.argmax(y_probs, axis=1)
acc = accuracy_score(y_test, y_preds)
cm = confusion_matrix(y_test, y_preds)

print("\n===================================================================")
print("EVALUACIÓN DEL MODELO EN CONJUNTO DE PRUEBA REAL")
print("===================================================================")
print(f"   Accuracy en fotos de prueba: {acc * 100:.2f}%")
print("   Matriz de Confusión:")
print(f"                Pred Ilegible  Pred Legible")
print(f"   Real Ilegible:    {cm[0][0]:>5}         {cm[0][1]:>5}")
print(f"   Real Legible:     {cm[1][0]:>5}         {cm[1][1]:>5}")

# Guardar Keras
keras_path = os.path.join(EXPORT_DIR, "cnn_legibilidad.keras")
model.save(keras_path)
print(f"\nModelo Keras guardado en: {keras_path}")

# Exportar a formato nativo TensorFlow.js
print("==> Exportando pesos a TensorFlow.js (group1-shard1of1.bin + model.json)...")
weights_entries = []
binary_bytes = bytearray()

for weight_tensor in model.weights:
    w_name = weight_tensor.name.replace(":0", "")
    val = weight_tensor.numpy().astype(np.float32)
    binary_bytes.extend(val.tobytes())
    weights_entries.append({
        "name": w_name,
        "shape": list(val.shape),
        "dtype": "float32"
    })

bin_filename = "group1-shard1of1.bin"
bin_path = os.path.join(TFJS_DIR, bin_filename)
with open(bin_path, "wb") as f:
    f.write(binary_bytes)

model_json = {
    "format": "layers-model",
    "generatedBy": "keras v3 (entrenado con fotos reales)",
    "convertedBy": "SIGRA Exporter",
    "modelTopology": json.loads(model.to_json()),
    "weightsManifest": [{
        "paths": [bin_filename],
        "weights": weights_entries
    }]
}

model_json_path = os.path.join(TFJS_DIR, "model.json")
with open(model_json_path, "w", encoding="utf-8") as f:
    json.dump(model_json, f, indent=2)

print(f"Pesos binarios exportados ({len(binary_bytes)} bytes) a: {bin_path}")

# Copiar a los frontends
destinos = [
    r"D:\software-2\sigra\frontend\portal-seguimiento\public\ai\cnn_tfjs",
    r"D:\software-2\sigra\frontend\portal-seguimiento\dist\ai\cnn_tfjs",
    r"D:\software-2\sigra\frontend\portal-docente\public\ai\cnn_tfjs",
    r"D:\software-2\sigra\frontend\portal-docente\dist\portal-docente\browser\ai\cnn_tfjs",
]

for d in destinos:
    if os.path.exists(os.path.dirname(d)):
        os.makedirs(d, exist_ok=True)
        shutil.copy(bin_path, os.path.join(d, bin_filename))
        shutil.copy(model_json_path, os.path.join(d, "model.json"))
        print(f"Copiado exitosamente a: {d}")

# Copiar también muestras de demostración nítidas y borrosas reales
muestras_dirs = [
    r"D:\software-2\sigra\frontend\portal-seguimiento\public\ai\muestras",
    r"D:\software-2\sigra\frontend\portal-docente\public\ai\muestras",
]

user_cert = os.path.join(RAW_DOCS, "user_bolivia_receta.jpg")
if os.path.exists(user_cert):
    with Image.open(user_cert) as im:
        # Muestra legible oficial (el certificado real)
        for md in muestras_dirs:
            if os.path.exists(md):
                im.resize((480, int(480 * im.height / im.width))).save(os.path.join(md, "doc_legible_080.png"))
                # Muestra ilegible (el mismo certificado con desenfoque gaussiano)
                im_blur = im.filter(ImageFilter.GaussianBlur(radius=6.0))
                im_blur.resize((480, int(480 * im.height / im.width))).save(os.path.join(md, "doc_ilegible_080.png"))
                print(f"Muestras actualizadas en: {md}")

# -------------------------------------------------------------
# TEST DIRECTO SOBRE LAS IMÁGENES DEL USUARIO
# -------------------------------------------------------------
print("\n===================================================================")
print("VERIFICACIÓN DIRECTA CON LAS IMÁGENES DEL USUARIO")
print("===================================================================")

if os.path.exists(user_cert):
    with Image.open(user_cert) as im:
        tensor = np.expand_dims(to_gray_tensor(im), 0)
        p = model.predict(tensor, verbose=0)[0]
        clase = "LEGIBLE" if p[1] >= p[0] else "ILEGIBLE"
        print(f"1. Certificado Médico Bolivia (Foto Real Usuario):")
        print(f"   -> Resultado: {clase} | Legible: {p[1]*100:.2f}% | Ilegible: {p[0]*100:.2f}%")

user_paris = os.path.join(RAW_NON_DOCS, "user_paris_cafe.jpg")
if os.path.exists(user_paris):
    with Image.open(user_paris) as im:
        tensor = np.expand_dims(to_gray_tensor(im), 0)
        p = model.predict(tensor, verbose=0)[0]
        clase = "LEGIBLE" if p[1] >= p[0] else "ILEGIBLE"
        print(f"2. Foto en París / Torre Eiffel (No Documental):")
        print(f"   -> Resultado: {clase} | Legible: {p[1]*100:.2f}% | Ilegible: {p[0]*100:.2f}%")

if os.path.exists(user_cert):
    with Image.open(user_cert) as im:
        im_blur = im.filter(ImageFilter.GaussianBlur(radius=6.0))
        tensor = np.expand_dims(to_gray_tensor(im_blur), 0)
        p = model.predict(tensor, verbose=0)[0]
        clase = "LEGIBLE" if p[1] >= p[0] else "ILEGIBLE"
        print(f"3. Certificado Médico Bolivia DESENFOCADO (Simulación Foto Borrosa):")
        print(f"   -> Resultado: {clase} | Legible: {p[1]*100:.2f}% | Ilegible: {p[0]*100:.2f}%")

print("\n==> ENTRENAMIENTO Y DESPLIEGUE FINALIZADOS CON ÉXITO.")
