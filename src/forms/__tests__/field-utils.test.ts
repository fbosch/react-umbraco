import { DefaultFieldType } from "../constants";
import { getAllFields, shouldSkipField } from "../field-utils";
import type { FormDto, FormFieldDto } from "../types";

describe("shouldSkipField", () => {
  it("returns true for TitleAndDescription type", () => {
    expect(
      shouldSkipField({
        type: { id: DefaultFieldType.TitleAndDescription },
      } as unknown as FormFieldDto),
    ).toBe(true);
  });

  it("returns false for non-TitleAndDescription type", () => {
    expect(
      shouldSkipField({
        type: { id: DefaultFieldType.ShortAnswer },
      } as unknown as FormFieldDto),
    ).toBe(false);
  });

  it("returns false if type is missing", () => {
    expect(shouldSkipField({} as unknown as FormFieldDto)).toBe(false);
  });
});

describe("getAllFields", () => {
  it("flattens fields from nested structure", () => {
    const form = {
      pages: [
        {
          fieldsets: [
            {
              columns: [
                {
                  fields: [{ id: "f1" }, { id: "f2" }],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as FormDto;
    const result = getAllFields(form);
    expect(result.map((f) => f.id)).toEqual(["f1", "f2"]);
  });

  it("returns cached result on second call", () => {
    const form = {
      pages: [
        {
          fieldsets: [
            {
              columns: [
                {
                  fields: [{ id: "f3" }],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as FormDto;
    const first = getAllFields(form);
    const second = getAllFields(form);
    expect(second).toStrictEqual(first);
  });

  it("throws if form has no fields", () => {
    const form = { pages: [] } as unknown as FormDto;
    expect(() => getAllFields(form)).toThrow();
  });
});
