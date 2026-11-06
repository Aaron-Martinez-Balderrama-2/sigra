import os
import json
import joblib
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
EXPORT_DIR = os.path.join(BASE_DIR, "exported")
os.makedirs(EXPORT_DIR, exist_ok=True)

csv_path = os.path.join(DATA_DIR, "dataset_estudiantes.csv")
if not os.path.exists(csv_path):
    raise FileNotFoundError(f"No se encontro {csv_path}. Ejecute 01_generar_datasets.py primero.")

print("===================================================================")
print("SIGRA AI - ENTRENAMIENTO SUPERVISADO: RANDOM FOREST (RIESGO ACADEMICO)")
print("===================================================================")

df = pd.read_csv(csv_path)
print(f"Dataset cargado con exito: {len(df)} registros.")

# Features y Target
feature_names = ["promedio_notas", "porcentaje_asistencia", "faltas_sin_justificar"]
X = df[feature_names]
y = df["nivel_riesgo"]

# Division 80% Entrenamiento / 20% Prueba Estratificada
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)

print(f"Muestras de entrenamiento: {len(X_train)} | Muestras de prueba: {len(X_test)}")

# Modelo Random Forest
clf = RandomForestClassifier(
    n_estimators=50,
    max_depth=6,
    random_state=42,
    criterion="gini"
)
clf.fit(X_train, y_train)

# Predicciones
y_pred = clf.predict(X_test)

# Metricas
acc = accuracy_score(y_test, y_pred)
labels = ["BAJO", "MEDIO", "ALTO"]
cm = confusion_matrix(y_test, y_pred, labels=labels)
report = classification_report(y_test, y_pred, labels=labels, output_dict=True)

print(f"\n==> RESULTADOS EVALUACION:")
print(f"    Accuracy Global: {acc * 100:.2f}%")
print("\n    Matriz de Confusion (Filas: Real, Columnas: Predicho):")
print("    " + "".join([f"{l:>8}" for l in labels]))
for i, row in enumerate(cm):
    print(f"    {labels[i]:<6}" + "".join([f"{val:>8}" for val in row]))

print("\n    Reporte Detallado por Clase:")
for l in labels:
    p = report[l]["precision"] * 100
    r = report[l]["recall"] * 100
    f1 = report[l]["f1-score"] * 100
    print(f"    * Clase {l:<5}: Precision={p:.1f}% | Recall={r:.1f}% | F1={f1:.1f}%")

# Importancia de caracteristicas
importancias = {name: round(float(imp), 4) for name, imp in zip(feature_names, clf.feature_importances_)}
print(f"\n    Importancia de Features: {importancias}")

# Guardar metricas en JSON
metricas_path = os.path.join(EXPORT_DIR, "metricas_ml.json")
data_existente = {}
if os.path.exists(metricas_path):
    try:
        with open(metricas_path, "r", encoding="utf-8") as f:
            data_existente = json.load(f)
    except Exception:
        pass

data_existente["random_forest"] = {
    "modelo": "RandomForestClassifier",
    "accuracy": round(float(acc), 4),
    "accuracy_porcentaje": f"{acc * 100:.2f}%",
    "clases": labels,
    "matriz_confusion": cm.tolist(),
    "importancia_variables": importancias,
    "reporte_clasificacion": {
        l: {
            "precision": round(report[l]["precision"], 4),
            "recall": round(report[l]["recall"], 4),
            "f1_score": round(report[l]["f1-score"], 4),
            "soporte": int(report[l]["support"])
        } for l in labels
    }
}

with open(metricas_path, "w", encoding="utf-8") as f:
    json.dump(data_existente, f, indent=2, ensure_ascii=False)

# Guardar artefacto serializado del modelo
model_path = os.path.join(EXPORT_DIR, "random_forest_riesgo.joblib")
joblib.dump(clf, model_path)
print(f"\n==> Artefactos exportados:")
print(f"    - Metricas: {metricas_path}")
print(f"    - Modelo guardado: {model_path}")
