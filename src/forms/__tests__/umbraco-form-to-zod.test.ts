import { z } from "zod";
import { DefaultFieldType } from "../constants";
import { getAllFields, shouldSkipField } from "../field-utils";
import type { FormDto, FormFieldDto } from "../types";
import {
  type MapFormFieldToZodFn,
  coerceFormData,
  findBaseDef,
  mapFieldToZod,
  umbracoFormToZodSchema,
} from "../umbraco-form-to-zod";
import formDefinition from "./__fixtures__/UmbracoForm.fixture.json";

const defaultFieldTypes = Object.fromEntries(Object.entries(DefaultFieldType));
const defaultFieldKeys = Object.keys(
  defaultFieldTypes,
) as (keyof typeof defaultFieldTypes)[];

const fieldMappings: Record<DefaultFieldType, unknown> = {
  [DefaultFieldType.RichText]: z.ZodString,
  [DefaultFieldType.LongAnswer]: z.ZodString,
  [DefaultFieldType.ShortAnswer]: z.ZodString,
  [DefaultFieldType.Password]: z.ZodString,
  [DefaultFieldType.HiddenField]: z.ZodString,
  [DefaultFieldType.MultipleChoice]: z.ZodString,
  [DefaultFieldType.Checkbox]: z.ZodBoolean,
  [DefaultFieldType.DataConsent]: z.ZodBoolean,
  [DefaultFieldType.Date]: z.ZodDate,
  [DefaultFieldType.DropdownList]: z.ZodString,
  [DefaultFieldType.FileUpload]: z.ZodString,
  [DefaultFieldType.SingleChoice]: z.ZodString,
  [DefaultFieldType.TitleAndDescription]: null,
  [DefaultFieldType.Recaptcha2]: z.ZodBoolean,
  [DefaultFieldType.RecaptchaV3WithScore]: z.ZodBoolean,
};

describe("mapFieldToZod", () => {
  describe("convert default fields to corresponding ZodType", () => {
    test.each(defaultFieldKeys.filter((key) => key !== "TitleAndDescription"))(
      "should convert %s to ZodType",
      (key) => {
        const zodType = mapFieldToZod({
          type: { id: defaultFieldTypes[key] },
        } as FormFieldDto);
        expect(zodType).toBeInstanceOf(z.ZodType);
      },
    );

    test("should skip TitleAndDescription field", () => {
      const zodType = mapFieldToZod({
        type: {
          id: DefaultFieldType.TitleAndDescription,
          name: "TitleAndDescription",
        },
      } as FormFieldDto);
      expect(zodType).toBeNull();
    });

    test.each(defaultFieldKeys)("should map %s to correct ZodType", (key) => {
      const field = { type: { id: defaultFieldTypes[key] } } as FormFieldDto;
      if (shouldSkipField(field)) {
        return;
      }
      const expectedZodType = fieldMappings[defaultFieldTypes[key]];
      const zodType = mapFieldToZod(field);
      if (zodType !== null) {
        expect(zodType).toBeInstanceOf(z.ZodOptional);
        expect(findBaseDef(zodType)).toBeInstanceOf(expectedZodType);
      }
    });
  });

  describe("custom fields", () => {
    const customField = {
      type: {
        id: "CustomField",
        name: "CustomField",
      },
    } as FormFieldDto;

    test("should throw if custom mapping function is not provided and field is attempted to be converted", () => {
      expect(() => mapFieldToZod(customField)).toThrowError();
    });

    test("should throw if custom mapping function does not return a zodType", () => {
      const customMappingFunction = (() =>
        undefined) as unknown as MapFormFieldToZodFn;
      expect(() =>
        mapFieldToZod(customField, customMappingFunction),
      ).toThrowError();
    });

    test("should return zodType if custom mapping function is provided and correctly implemented", () => {
      const customMappingFunction: MapFormFieldToZodFn = () => z.string();
      const zodType = mapFieldToZod(customField, customMappingFunction);
      expect(zodType).toBeInstanceOf(z.ZodType);
    });
  });

  describe("negative and edge cases", () => {
    test("throws if field.type is missing", () => {
      //@ts-expect-error
      const field = { type: undefined } as FormFieldDto;
      expect(() => mapFieldToZod(field)).toThrowError();
    });

    test("throws if field.type.id is missing", () => {
      //@ts-expect-error
      const field = { type: { id: undefined } } as FormFieldDto;
      expect(() => mapFieldToZod(field)).toThrowError();
    });

    test("throws if field.type.id is unknown", () => {
      const field = { type: { id: "NonExistentType" } } as FormFieldDto;
      expect(() => mapFieldToZod(field)).toThrowError();
    });
  });
});

describe("umbracoFormToZodSchema", () => {
  test("should convert form definition to zod schema", () => {
    const schema = umbracoFormToZodSchema(formDefinition as FormDto);
    expect(schema).toBeInstanceOf(z.ZodType);
    expect(schema).toMatchSnapshot();
  });

  test("form definition with no fields throws error", () => {
    const form = { fields: [] } as unknown as FormDto;
    expect(() => umbracoFormToZodSchema(form)).toThrowError();
  });

  test("empty input throws error", () => {
    expect(() =>
      umbracoFormToZodSchema({} as unknown as FormDto),
    ).toThrowError();
    expect(() =>
      umbracoFormToZodSchema(undefined as unknown as FormDto),
    ).toThrowError();
    expect(() =>
      umbracoFormToZodSchema(null as unknown as FormDto),
    ).toThrowError();
    expect(() =>
      umbracoFormToZodSchema(0 as unknown as FormDto),
    ).toThrowError();
  });
});

describe("coerceFormData", () => {
  test("should coerce form data to correct types", () => {
    const schema = z.object({ agree: z.boolean() });
    const formData = new FormData();
    formData.append("agree", "on");
    const data = coerceFormData(formData, schema);
    expect(data.agree).toBe(true);
  });
});
