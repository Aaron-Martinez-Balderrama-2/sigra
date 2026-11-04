<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * Sanitización y Validación: EvaluarRiesgoRequest
 */
class EvaluarRiesgoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'asistenciaPorcentaje' => [
                'required',
                'numeric',
                'min:0',
                'max:100',
            ],
            'promedioCalificaciones' => [
                'required',
                'numeric',
                'min:0',
                'max:100',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'asistenciaPorcentaje.required' => 'El porcentaje de asistencia es obligatorio.',
            'asistenciaPorcentaje.min' => 'El porcentaje de asistencia no puede ser menor a 0.',
            'asistenciaPorcentaje.max' => 'El porcentaje de asistencia no puede ser mayor a 100.',
            'promedioCalificaciones.required' => 'El promedio de calificaciones es obligatorio.',
            'promedioCalificaciones.min' => 'El promedio de calificaciones no puede ser menor a 0.',
            'promedioCalificaciones.max' => 'El promedio de calificaciones no puede ser mayor a 100.',
        ];
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'status' => 'ERROR_VALIDACION',
            'mensaje' => 'Parámetros métricos fuera de rango permitido.',
            'errores' => $validator->errors(),
        ], 422));
    }
}
