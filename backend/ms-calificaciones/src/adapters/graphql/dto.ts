import { Field, Float, InputType, Int, ObjectType } from '@nestjs/graphql';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
@InputType()
export class ContextInput {
  @Field() @Matches(/^[a-zA-Z0-9_.-]{2,64}$/) cursoId!: string;
  @Field() @Matches(/^[a-zA-Z0-9_.-]{2,64}$/) materiaId!: string;
  @Field(() => Int) @IsInt() @Min(2020) @Max(2100) gestion!: number;
  @Field(() => Int) @IsInt() @Min(1) @Max(3) trimestre!: number;
}
@InputType()
export class ResultDto extends ContextInput {
  @Field() @Matches(/^[a-zA-Z0-9_.-]{2,64}$/) estudianteId!: string;
}
@InputType()
export class CloseDto extends ContextInput {
  @Field() @IsUUID('4') operationId!: string;
}
@ObjectType()
export class PeriodView {
  @Field() id!: string;
  @Field() estado!: string;
  @Field(() => Int) version!: number;
}
@InputType()
export class PrepareDto extends ContextInput {
  @Field() @IsUUID('4') operationId!: string;
  @Field({ nullable: true }) @IsOptional() @IsUUID('4') evaluacionId?: string;
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  versionEsperada?: number;
  @Field() @IsString() @Length(1, 120) @Matches(/\S/) nombre!: string;
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  descripcion?: string;
  @Field() @IsDateString({ strict: true }) fecha!: string;
}
@InputType()
export class NoteDto {
  @Field() @Matches(/^[a-zA-Z0-9_.-]{2,64}$/) estudianteId!: string;
  @Field(() => Float)
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(100)
  nota!: number;
}
@InputType()
export class GradesDto {
  @Field() @IsUUID('4') operationId!: string;
  @Field() @IsUUID('4') evaluacionId!: string;
  @Field(() => Int) @IsInt() @Min(1) versionEsperada!: number;
  @Field(() => [NoteDto])
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => NoteDto)
  notas!: NoteDto[];
}
@InputType()
export class PublishDto {
  @Field() @IsUUID('4') operationId!: string;
  @Field() @IsUUID('4') evaluacionId!: string;
  @Field(() => Int) @IsInt() @Min(1) versionEsperada!: number;
  @Field(() => Boolean, { defaultValue: false })
  @IsBoolean()
  cerrarTrimestre: boolean = false;
}
@ObjectType()
export class GradeView {
  @Field() estudianteId!: string;
  @Field(() => Float) nota!: number;
  @Field(() => Int) version!: number;
}
@ObjectType()
export class EvaluationView {
  @Field() id!: string;
  @Field() nombre!: string;
  @Field() descripcion!: string;
  @Field() fecha!: string;
  @Field() cursoId!: string;
  @Field() materiaId!: string;
  @Field(() => Int) gestion!: number;
  @Field(() => Int) trimestre!: number;
  @Field() estado!: string;
  @Field(() => Int) version!: number;
  @Field(() => [GradeView], { nullable: true }) notas?: GradeView[];
}
@ObjectType()
export class SavedView {
  @Field() evaluacionId!: string;
  @Field(() => Int) version!: number;
  @Field(() => Int) guardadas!: number;
}
@ObjectType()
export class SagaView {
  @Field() id!: string;
  @Field() evaluacionId!: string;
  @Field() estado!: string;
  @Field() cerrarTrimestre!: boolean;
  @Field({ nullable: true }) error?: string;
}
@ObjectType()
export class ActivityView {
  @Field() evaluacionId!: string;
  @Field() nombre!: string;
  @Field() estado!: string;
  @Field(() => Float, { nullable: true }) nota!: number | null;
}
@ObjectType()
export class ResultView {
  @Field() estudianteId!: string;
  @Field() cursoId!: string;
  @Field() materiaId!: string;
  @Field(() => Int) gestion!: number;
  @Field(() => Int) trimestre!: number;
  @Field() estado!: string;
  @Field() completo!: boolean;
  @Field(() => Float, { nullable: true }) promedio!: number | null;
  @Field(() => Int) pendientes!: number;
  @Field(() => [ActivityView], { nullable: true }) actividades?: ActivityView[];
}
@ObjectType()
export class ExternalView {
  @Field() disponible!: boolean;
  @Field({ nullable: true }) motivo?: string;
  @Field({ nullable: true }) datosJson?: string;
}
@ObjectType()
export class FileView {
  @Field(() => ResultView) calificaciones!: ResultView;
  @Field(() => ExternalView) asistencia!: ExternalView;
  @Field(() => ExternalView) alertas!: ExternalView;
}
