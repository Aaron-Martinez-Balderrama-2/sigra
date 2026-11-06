import os
import random
import numpy as np
import pandas as pd
from PIL import Image, ImageDraw, ImageFilter

# Fijar semilla determinista para reproducibilidad estricta
random.seed(42)
np.random.seed(42)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
DOCS_DIR = os.path.join(DATA_DIR, "dataset_documentos")

TEXTOS_CERTIFICADOS = [
    "CERTIFICADO MEDICO CLINICA CENTRAL",
    "JUSTIFICATIVO DE INASISTENCIA ESCOLAR",
    "DIAGNOSTICO: FARINGITIS AGUDA - REPOSO 48H",
    "CONSULTA EXTERNA DRA. LOPEZ REG. 4812",
    "HOSPITAL MUNICIPAL DE URGENCIAS",
    "REPOSO MEDICO EMITIDO POR ESPECIALISTA",
]

def crear_imagen_documento(texto, legible=True, seed=0):
    img = Image.new("RGB", (128, 128), color=(250, 250, 250))
    draw = ImageDraw.Draw(img)
    
    # Borde de documento
    draw.rectangle([6, 6, 121, 121], outline=(180, 180, 180), width=2)
    # Encabezado simulado
    draw.line([14, 25, 114, 25], fill=(70, 70, 150), width=2)
    
    # Líneas de texto simuladas
    y_pos = 35
    for linea in texto.split(" - "):
        draw.text((14, y_pos), linea[:22], fill=(20, 20, 20))
        y_pos += 16
        
    # Sello simulado
    draw.ellipse([70, 80, 110, 115], outline=(180, 50, 50), width=2)
    draw.text((75, 92), "VALID", fill=(180, 50, 50))
    
    if not legible:
        # Aplicar distorsión, desenfoque gaussiano y ruido para clase ILEGIBLE
        img = img.filter(ImageFilter.GaussianBlur(radius=random.uniform(4.0, 7.5)))
        # Añadir ruido aleatorio
        arr = np.array(img).astype(np.float32)
        ruido = np.random.normal(0, 25, arr.shape)
        arr = np.clip(arr + ruido, 0, 255).astype(np.uint8)
        img = Image.fromarray(arr)
    else:
        # Leve variación realista para clase LEGIBLE (nitidez alta)
        img = img.filter(ImageFilter.UnsharpMask(radius=1, percent=120, threshold=2))
        
    # Redimensionar al tamaño estándar de la CNN (64x64)
    return img.resize((64, 64), Image.Resampling.LANCZOS)

def generar_todos_los_datasets():
    os.makedirs(DATA_DIR, exist_ok=True)
    for split in ["train", "test"]:
        for label in ["legible", "ilegible"]:
            os.makedirs(os.path.join(DOCS_DIR, split, label), exist_ok=True)

    # 1. Dataset Tabular
    print("==> Generando dataset_estudiantes.csv (500 registros)...")
    estudiantes = []
    cursos = ["sec-1a", "sec-1b", "sec-2a", "sec-2b", "sec-3a", "sec-3b"]

    for i in range(1, 501):
        est_id = f"est-{i:03d}"
        curso = random.choice(cursos)
        
        perfil = random.choices(["bueno", "medio", "critico"], weights=[0.65, 0.20, 0.15])[0]
        if perfil == "bueno":
            promedio = round(random.uniform(70.0, 98.0), 1)
            asistencia = round(random.uniform(85.0, 100.0), 1)
            faltas_sj = random.randint(0, 1)
        elif perfil == "medio":
            promedio = round(random.uniform(51.0, 69.9), 1)
            asistencia = round(random.uniform(65.0, 84.9), 1)
            faltas_sj = random.randint(1, 3)
        else:
            promedio = round(random.uniform(25.0, 50.9), 1)
            asistencia = round(random.uniform(40.0, 64.9), 1)
            faltas_sj = random.randint(3, 8)

        if promedio < 51.0 or asistencia < 65.0 or faltas_sj >= 4:
            riesgo = "ALTO"
        elif promedio < 70.0 or asistencia < 80.0 or faltas_sj >= 2:
            riesgo = "MEDIO"
        else:
            riesgo = "BAJO"

        estudiantes.append({
            "estudiante_id": est_id,
            "curso_id": curso,
            "promedio_notas": promedio,
            "porcentaje_asistencia": asistencia,
            "faltas_sin_justificar": faltas_sj,
            "nivel_riesgo": riesgo
        })

    df_estudiantes = pd.DataFrame(estudiantes)
    csv_path = os.path.join(DATA_DIR, "dataset_estudiantes.csv")
    df_estudiantes.to_csv(csv_path, index=False, encoding="utf-8")
    print(f"    Dataset guardado en: {csv_path}")

    # 2. Dataset Imagenes
    print("\n==> Generando dataset_documentos (200 imágenes: 100 legibles / 100 ilegibles)...")
    TOTAL_POR_CLASE = 100
    TRAIN_RATIO = 0.8
    N_TRAIN = int(TOTAL_POR_CLASE * TRAIN_RATIO)

    for idx in range(TOTAL_POR_CLASE):
        split = "train" if idx < N_TRAIN else "test"
        texto = random.choice(TEXTOS_CERTIFICADOS)
        
        img_legible = crear_imagen_documento(texto, legible=True, seed=idx)
        path_legible = os.path.join(DOCS_DIR, split, "legible", f"doc_legible_{idx:03d}.png")
        img_legible.save(path_legible)
        
        img_ilegible = crear_imagen_documento(texto, legible=False, seed=idx + 1000)
        path_ilegible = os.path.join(DOCS_DIR, split, "ilegible", f"doc_ilegible_{idx:03d}.png")
        img_ilegible.save(path_ilegible)

    print(f"    Imagenes guardadas exitosamente en: {DOCS_DIR}")
    print("==> GENERACION DE DATASETS COMPLETADA EXITOSAMENTE.")

if __name__ == "__main__":
    generar_todos_los_datasets()
