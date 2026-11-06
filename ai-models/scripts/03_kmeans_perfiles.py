import os
import json
import joblib
import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
EXPORT_DIR = os.path.join(BASE_DIR, "exported")
os.makedirs(EXPORT_DIR, exist_ok=True)

csv_path = os.path.join(DATA_DIR, "dataset_estudiantes.csv")
if not os.path.exists(csv_path):
    raise FileNotFoundError(f"No se encontro {csv_path}. Ejecute 01_generar_datasets.py primero.")

print("===================================================================")
print("SIGRA AI - APRENDIZAJE NO SUPERVISADO: K-MEANS (PERFILES ACADEMICOS)")
print("===================================================================")

df = pd.read_csv(csv_path)

# Variables de agrupamiento: Promedio de notas y Porcentaje de asistencia
features = ["promedio_notas", "porcentaje_asistencia"]
X = df[features].values

# Normalizacion estandar
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# K-Means con k=3 clusters
k = 3
kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
cluster_labels = kmeans.fit_predict(X_scaled)
df["cluster"] = cluster_labels

# Evaluacion con Silhouette Score
score = silhouette_score(X_scaled, cluster_labels)
print(f"==> K-Means entrenado exitosamente con k={k}")
print(f"    Silhouette Score: {score:.4f} (Separacion satisfactoria de clusters)")

# Centroides en escala original
centroides_originales = scaler.inverse_transform(kmeans.cluster_centers_)

# Caracterizacion de los 3 perfiles
perfiles = []
for i in range(k):
    subset = df[df["cluster"] == i]
    prom_notas = float(centroides_originales[i][0])
    prom_asist = float(centroides_originales[i][1])
    conteo = int(len(subset))
    
    # Asignacion de nombre conceptual al perfil
    if prom_notas >= 75 and prom_asist >= 85:
        nombre_perfil = "Alto Desempeño y Asistencia Regular"
        tipo = "DESTACADO"
    elif prom_notas < 55 or prom_asist < 70:
        nombre_perfil = "Riesgo Crítico de Deserción/Reprobación"
        tipo = "CRITICO"
    else:
        nombre_perfil = "Vulnerabilidad Académica Moderada"
        tipo = "MEDIO"
        
    perfiles.append({
        "cluster_id": i,
        "tipo": tipo,
        "nombre_perfil": nombre_perfil,
        "conteo_estudiantes": conteo,
        "porcentaje_poblacion": f"{conteo / len(df) * 100:.1f}%",
        "centroide_promedio_notas": round(prom_notas, 2),
        "centroide_porcentaje_asistencia": round(prom_asist, 2)
    })

print("\n==> CENTROIDES Y PERFILES ENCONTRADOS:")
for p in perfiles:
    print(f"    Cluster {p['cluster_id']} [{p['tipo']}]: {p['nombre_perfil']}")
    print(f"      - Estudiantes: {p['conteo_estudiantes']} ({p['porcentaje_poblacion']})")
    print(f"      - Centroide: Promedio={p['centroide_promedio_notas']} pts | Asistencia={p['centroide_porcentaje_asistencia']}%")

# Guardar metricas en JSON
metricas_path = os.path.join(EXPORT_DIR, "metricas_ml.json")
data_existente = {}
if os.path.exists(metricas_path):
    try:
        with open(metricas_path, "r", encoding="utf-8") as f:
            data_existente = json.load(f)
    except Exception:
        pass

data_existente["kmeans"] = {
    "modelo": "KMeans",
    "k_clusters": k,
    "silhouette_score": round(float(score), 4),
    "perfiles": perfiles,
    "centroides_normalizados": kmeans.cluster_centers_.tolist()
}

with open(metricas_path, "w", encoding="utf-8") as f:
    json.dump(data_existente, f, indent=2, ensure_ascii=False)

# Guardar centroides especificos para consumo visual del Frontend
centroids_path = os.path.join(EXPORT_DIR, "cluster_centroids.json")
with open(centroids_path, "w", encoding="utf-8") as f:
    json.dump({"clusters": perfiles}, f, indent=2, ensure_ascii=False)

# Guardar modelos serializados
joblib.dump(kmeans, os.path.join(EXPORT_DIR, "kmeans_model.joblib"))
joblib.dump(scaler, os.path.join(EXPORT_DIR, "kmeans_scaler.joblib"))

print(f"\n==> Artefactos exportados:")
print(f"    - Metricas actualizadas en: {metricas_path}")
print(f"    - Centroides para Frontend: {centroids_path}")
