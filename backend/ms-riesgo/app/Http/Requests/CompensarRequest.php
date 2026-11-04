<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Sanitización y Validación: CompensarRequest (Saga Rollback)
 */
class CompensarRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'motivo' => [
                'nullable',
                'string',
                'max:255',
            ],
        ];
    }
}
