import { z } from "zod";
import { DefaultFieldType } from "../constants";
import { getAllFields } from "../field-utils";
import type { FormDto, FormFieldDto } from "../types";
import {
  type MapFormFieldToZodFn,
  mapFieldToZod,
  umbracoFormToZodSchema,
} from "../umbraco-form-to-zod";
import formDefinition from "./__fixtures__/UmbracoForm.fixture.json";

const defaultFieldTypes = Object.fromEntries(Object.entries(DefaultFieldType));
const defaultFieldKeys = Object.keys(
  defaultFieldTypes,
) as (keyof typeof defaultFieldTypes)[];

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

    test("should be optional if field defintion is marked as required: false", () => {
      const customMappingFunction: MapFormFieldToZodFn = () => z.string();
      const zodType = mapFieldToZod(
        { ...customField, required: false },
        customMappingFunction,
      );
      expect(zodType).toBeInstanceOf(z.ZodOptional);
    });
  });
});

describe("umbracoFormToZod", () => {
  test.skip("should convert form definition to zod schema", () => {
    const schema = umbracoFormToZodSchema(formDefinition as FormDto);
    expect(schema).toBeInstanceOf(z.ZodType);
    expect(schema).toMatchSnapshot();
  });
});
