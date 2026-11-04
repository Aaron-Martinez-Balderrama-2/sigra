<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * Sanitización y Validación de Entrada: CrearAnalisisRequest
 * Satisface Requisito 1.12 (Sanitización estricta contra inyecciones y datos maliciosos).
 */
class CrearAnalisisRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Prepara los datos antes de validar: si viene en el header X-Idempotency-Key, lo absorbe.
     */
    protected function prepareForValidation(): void
    {
        $idempotencyHeader = $this->header('X-Idempotency-Key');
        if (!empty($idempotencyHeader) && !$this->has('operationId')) {
            $this->merge(['operationId' => trim($idempotencyHeader)]);
        }
    }

    public function rules(): array
    {
        return [
            'operationId' => [
                'required',
                'string',
                'min:8',
                'max:128',
                'regex:/^[a-zA-Z0-9_\-]+$/',
            ],
            'estudianteId' => [
                'required',
                'string',
                'min:2',
                'max:64',
                'regex:/^[a-zA-Z0-9_\-\.]+$/',
            ],
            'cursoId' => [
                'required',
                'string',
                'min:2',
                'max:64',
                'regex:/^[a-zA-Z0-9_\-\.]+$/',
            ],
            'evaluacionId' => [
                'required',
                'string',
                'min:2',
                'max:64',
                'regex:/^[a-zA-Z0-9_\-\.]+$/',
            ],
            'sagaId' => [
                'nullable',
                'string',
                'max:128',
                'regex:/^[a-zA-Z0-9_\-]+$/',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'operationId.required' => 'La clave de operación (operationId o header X-Idempotency-Key) es obligatoria.',
            'operationId.regex' => 'El operationId contiene caracteres no permitidos (solo alfanumérico, guiones y barras bajas).',
            'estudianteId.required' => 'El identificador de estudiante es obligatorio.',
            'cursoId.required' => 'El identificador de curso es obligatorio.',
            'evaluacionId.required' => 'El identificador de evaluación es obligatorio.',
        ];
    }

    /**
     * Respuesta JSON estructurada inmediata en caso de fallo de validación (Sanitización).
     */
    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'status' => 'ERROR_VALIDACION',
            'mensaje' => 'Los datos de la solicitud no superaron las reglas de sanitización.',
            'errores' => $validator->errors(),
        ], 422));
    }
}
