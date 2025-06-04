import * as React from "react";
import { type ZodIssue, ZodIssueCode } from "zod";
import { isVisibleBasedOnCondition } from "./conditions";
import * as defaultComponents from "./default-components";
import {
  filterFieldsByConditions,
  getAllFieldsOnPage,
  getFieldByZodIssue,
  getRecaptcha2Field,
  getRecaptchaV3WithScoreField,
} from "./field-utils";
import type { DtoWithCondition, FormDto, UmbracoFormConfig } from "./types";
import {
  coerceFormData,
  sortZodIssuesByFieldAlias,
  umbracoFormPageToZodSchema,
  umbracoFormPagesToZodSchemas,
  umbracoFormToZodSchema,
} from "./umbraco-form-to-zod";

// biome-ignore lint/suspicious/noExplicitAny: allow for any type
type RenderFn<T extends React.JSXElementConstructor<any>> = (
  props: React.ComponentProps<T>,
) => React.ReactNode;

export interface UmbracoFormProps
  extends React.FormHTMLAttributes<HTMLFormElement> {
  /** Custom onSubmit handler that provides form event and optional data object */
  onSubmit?: (
    e: React.FormEvent<HTMLFormElement>,
    data?: Record<string, unknown>,
  ) => void;
  /** Form definition object */
  form: FormDto;
  /** Optional configuration overrides for the Umbraco form */
  config?: Partial<UmbracoFormConfig>;
  validateRecaptcha?: () => boolean;
  /** Custom render function for the form */
  renderForm?: RenderFn<typeof defaultComponents.Form>;
  /** Custom render function for a page within the form */
  renderPage?: RenderFn<typeof defaultComponents.Page>;
  /** Custom render function for a fieldset within the form */
  renderFieldset?: RenderFn<typeof defaultComponents.Fieldset>;
  /** Custom render function for a column within the form */
  renderColumn?: RenderFn<typeof defaultComponents.Column>;
  /** Custom render function for a field within the form */
  renderField?: RenderFn<typeof defaultComponents.Field>;
  /** Custom render function for a specific field type within the form */
  renderFieldType?: RenderFn<typeof defaultComponents.FieldType>;
  /** Custom render function for the validation summary */
  renderValidationSummary?: RenderFn<
    typeof defaultComponents.ValidationSummary
  >;
  /** Custom render function for the submit button */
  renderSubmitButton?: RenderFn<typeof defaultComponents.SubmitButton>;
  /** Custom render function for the next button in multi-step forms */
  renderNextButton?: RenderFn<typeof defaultComponents.NextButton>;
  /** Custom render function for the previous button in multi-step forms */
  renderPreviousButton?: RenderFn<typeof defaultComponents.PreviousButton>;
}

function UmbracoForm(props: UmbracoFormProps) {
  const {
    form,
    config: configOverride = {},
    validateRecaptcha,
    renderForm: Form = defaultComponents.Form,
    renderPage: Page = defaultComponents.Page,
    renderFieldset: Fieldset = defaultComponents.Fieldset,
    renderColumn: Column = defaultComponents.Column,
    renderField: Field = defaultComponents.Field,
    renderFieldType: FieldType = defaultComponents.FieldType,
    renderSubmitButton: SubmitButton = defaultComponents.SubmitButton,
    renderNextButton: NextButton = defaultComponents.NextButton,
    renderPreviousButton: PreviousButton = defaultComponents.PreviousButton,
    renderValidationSummary:
      ValidationSummary = defaultComponents.ValidationSummary,
    children,
    onChange,
    onSubmit,
    onBlur,
    ...rest
  } = props;

  const config = {
    schema: configOverride?.schema ?? umbracoFormToZodSchema(form),
    shouldValidate: false,
    shouldUseNativeValidation: false,
    validateMode: "onSubmit",
    reValidateMode: "onBlur",
    ...configOverride,
  } as UmbracoFormConfig;

  const [internalData, setInternalData] = React.useState<
    Record<string, unknown>
  >({});
  const deferredInternalData = React.useDeferredValue(internalData);

  const [attemptCount, setAttemptCount] = React.useState<number>(0);
  const [formIssues, setFormIssues] = React.useState<ZodIssue[]>([]);
  const [summaryIssues, setSummaryIssues] = React.useState<ZodIssue[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = React.useState(0);
  const activePage = form?.pages?.[currentPageIndex];

  const checkCondition = (dto: DtoWithCondition) =>
    isVisibleBasedOnCondition(
      dto,
      form,
      deferredInternalData,
      config?.mapCustomFieldToZodType,
    );

  const totalPages = form?.pages?.filter(checkCondition).length ?? 1;

  const isRecaptchaInvalid = React.useCallback(() => {
    if (getRecaptcha2Field(form) || getRecaptchaV3WithScoreField(form)) {
      return validateRecaptcha?.() === false || false;
    }
    return false;
  }, [validateRecaptcha, form]);

  const validateFormData = React.useCallback(
    (coercedData: Record<string, unknown>, fieldName?: string) => {
      const parsedForm = config?.schema?.safeParse(coercedData);
      const formIssues: ZodIssue[] = [];

      if (isRecaptchaInvalid()) {
        const recaptcha2Field = getRecaptcha2Field(form);
        if (recaptcha2Field?.alias) {
          formIssues.push({
            code: ZodIssueCode.custom,
            path: [recaptcha2Field.alias],
            message: recaptcha2Field.requiredErrorMessage ?? "",
          });
        }
        const recaptchaV3Field = getRecaptchaV3WithScoreField(form);
        if (recaptchaV3Field?.alias) {
          formIssues.push({
            code: ZodIssueCode.custom,
            path: [recaptchaV3Field.alias],
            message: recaptchaV3Field.requiredErrorMessage ?? "",
          });
        }
      }

      if (!parsedForm?.success) {
        setFormIssues((prev) =>
          sortZodIssuesByFieldAlias(
            form,
            (fieldName
              ? [
                  ...prev.filter((issue) => issue.path.join(".") !== fieldName),
                  ...parsedForm.error.issues.filter(
                    (issue) => issue.path.join(".") === fieldName,
                  ),
                ]
              : parsedForm.error.issues
            ).concat(formIssues),
          ),
        );
        return parsedForm;
      }

      setFormIssues(formIssues);
      return parsedForm;
    },
    [form, config.schema, isRecaptchaInvalid],
  );

  const isCurrentPageValid = React.useCallback(() => {
    // dont validate fields that are not visible to the user
    const fieldsWithConditionsMet = filterFieldsByConditions(
      form,
      deferredInternalData,
      config.mapCustomFieldToZodType,
    ).map((field) => field.alias);

    // get all fields with issues and filter out fields with conditions that are not met
    const allFieldIssues = validateFormData(
      deferredInternalData,
    ).error?.issues?.filter((issue) =>
      fieldsWithConditionsMet.includes(getFieldByZodIssue(form, issue)?.alias),
    );

    // get all aliases for fields with issues
    const fieldAliasesWithIssues = allFieldIssues?.map(
      (issue) => getFieldByZodIssue(form, issue)?.alias,
    );

    // get all fields on the current page and filter out fields with conditions that are not met
    // so that they wont block the user from going to the next page
    const fieldsOnPage = getAllFieldsOnPage(activePage)?.filter((field) =>
      fieldsWithConditionsMet.includes(field?.alias),
    );

    const aliasesOnPage = fieldsOnPage?.map((field) => field?.alias) ?? [];

    const pageIssues =
      allFieldIssues?.filter((issue) =>
        aliasesOnPage?.includes(getFieldByZodIssue(form, issue)?.alias),
      ) ?? [];

    if (
      fieldsOnPage?.some(
        (field) => field && fieldAliasesWithIssues?.includes(field.alias),
      )
    ) {
      // prevent user from going to next page if there are fields with issues on the current page
      setAttemptCount((prev) => prev + 1);
      if (form.showValidationSummary) {
        setSummaryIssues(pageIssues);
      }
      return false;
    }
    return true;
  }, [config, form, activePage, validateFormData, deferredInternalData]);

  const handleOnChange = React.useCallback(
    (e: React.ChangeEvent<HTMLFormElement>) => {
      const field = e.target;
      const formData = new FormData(e.currentTarget);
      const fieldsOnPage = getAllFieldsOnPage(activePage);

      // omit fields that are not on the current page
      const coercedData = Object.fromEntries(
        Object.entries(coerceFormData(formData, config.schema)).filter(
          ([key]) => fieldsOnPage?.some((field) => field?.alias === key),
        ),
      );

      setInternalData((prev) => {
        // merge data with previous data (from prior pages)
        return !prev ? coercedData : { ...prev, ...coercedData };
      });

      if (config.shouldValidate && config.shouldUseNativeValidation === false) {
        const validateOnChange =
          config.validateMode === "onChange" ||
          config.validateMode === "all" ||
          (attemptCount > 0 && config.reValidateMode === "onChange");

        if (validateOnChange) {
          React.startTransition(() => {
            if (validateFormData(coercedData, field.name).success === false) {
              return;
            }
            if (typeof onChange === "function") {
              onChange(e);
            }
          });
        }
      }

      if (typeof onChange === "function") {
        onChange(e);
      }
    },
    [config, attemptCount, activePage, validateFormData, onChange],
  );

  const handleOnBlur = React.useCallback(
    (e: React.FocusEvent<HTMLFormElement, HTMLElement>) => {
      const field = e.target;
      const formData = new FormData(e.currentTarget as HTMLFormElement);
      const coercedData = coerceFormData(formData, config.schema);

      if (config.shouldValidate && config.shouldUseNativeValidation === false) {
        const validateOnBlur =
          config.validateMode === "onBlur" ||
          config.validateMode === "all" ||
          (attemptCount > 0 && config.reValidateMode === "onBlur");

        if (validateOnBlur) {
          React.startTransition(() => {
            validateFormData(coercedData, field.name);
            if (form.pages && form.pages?.length > 1) {
              isCurrentPageValid();
            }
          });
        }
      }

      if (typeof onBlur === "function") {
        onBlur(e);
      }
    },
    [onBlur, validateFormData, form, isCurrentPageValid, attemptCount, config],
  );

  const scrollToTopOfForm = React.useCallback(() => {
    const formElement = document.querySelector(`[name="${form.id}"]`);
    if (formElement) {
      formElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [form]);

  const focusFirstInvalidField = React.useCallback(() => {
    const fieldWithIssues = formIssues?.find((issue) => issue.path.length > 0);
    if (fieldWithIssues) {
      const fieldId = fieldWithIssues.path.join(".");
      if (fieldId) {
        const fieldElement = document.querySelector(
          `[name="${fieldId}"]`,
        ) as HTMLInputElement;
        if (fieldElement) {
          fieldElement.focus();
        }
      }
    }
  }, [formIssues]);

  const handleNextPage = React.useCallback(() => {
    if (config.shouldValidate && config.shouldUseNativeValidation === false) {
      React.startTransition(() => {
        if (isCurrentPageValid() === false) {
          scrollToTopOfForm();
          focusFirstInvalidField();
          setAttemptCount((prev) => prev + 1);
          return;
        }
        setCurrentPageIndex((prev) => prev + 1);
        setAttemptCount(0);
      });
    } else {
      setCurrentPageIndex((prev) => prev + 1);
    }
  }, [config, isCurrentPageValid, focusFirstInvalidField, scrollToTopOfForm]);

  const handlePreviousPage = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setCurrentPageIndex((prev) => (prev === 0 ? prev : prev - 1));
      scrollToTopOfForm();
    },
    [scrollToTopOfForm],
  );

  const handleOnSubmit = React.useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      if (config.shouldValidate && config.shouldUseNativeValidation === false) {
        e.preventDefault();
        if (totalPages > 1 && currentPageIndex !== totalPages - 1) {
          return handleNextPage();
        }
        React.startTransition(() => {
          setAttemptCount((prev) => prev + 1);
          const validationResult = validateFormData(internalData);

          if (validationResult.success === false) {
            focusFirstInvalidField();
            if (form.showValidationSummary) {
              setSummaryIssues(validationResult.error.issues);
            }
            return;
          }
          setSummaryIssues([]);
          if (typeof onSubmit === "function") {
            onSubmit(e, internalData);
          }
        });
      } else {
        if (typeof onSubmit === "function") {
          onSubmit(e, internalData);
        }
      }
    },
    [
      totalPages,
      currentPageIndex,
      focusFirstInvalidField,
      config,
      onSubmit,
      internalData,
      form.showValidationSummary,
      handleNextPage,
      validateFormData,
    ],
  );

  const context = {
    form,
    config,
  };

  return (
    <React.Fragment>
      {form.showValidationSummary && attemptCount > 0 ? (
        <ValidationSummary {...context} issues={summaryIssues} />
      ) : null}
      <Form
        {...rest}
        onChange={handleOnChange}
        onSubmit={handleOnSubmit}
        onBlur={handleOnBlur}
        {...context}
      >
        {form?.pages?.map((page, index) => (
          <Page
            key={`page.${index}`}
            page={page}
            pageIndex={index}
            condition={checkCondition(page)}
            currentPage={currentPageIndex}
            totalPages={totalPages}
            {...context}
          >
            {page?.fieldsets?.map((fieldset, index) => (
              <Fieldset
                key={`fieldset.${index}`}
                fieldset={fieldset}
                condition={checkCondition(fieldset)}
                {...context}
              >
                {fieldset?.columns?.map((column, index) => (
                  <Column key={`column.${index}`} column={column} {...context}>
                    {column?.fields?.map((field) => {
                      const issues = formIssues?.filter(
                        (issue) => issue.path.join(".") === field.alias,
                      );
                      const defaultValue = field?.alias
                        ? (deferredInternalData[field.alias] as string)
                        : undefined;
                      const fieldTypeProps = {
                        field,
                        issues,
                        defaultValue,
                        ...context,
                      };
                      return (
                        <Field
                          key={`field.${field?.id}`}
                          field={field}
                          condition={checkCondition(field)}
                          issues={issues}
                          {...context}
                        >
                          {
                            // fallback to default component if custom component returns undefined
                            FieldType(fieldTypeProps) ??
                              defaultComponents.FieldType(fieldTypeProps)
                          }
                        </Field>
                      );
                    })}
                  </Column>
                ))}
              </Fieldset>
            ))}
          </Page>
        ))}
        {children}
        {totalPages > 1 ? (
          <React.Fragment>
            <PreviousButton
              onClick={handlePreviousPage}
              currentPage={currentPageIndex}
              totalPages={totalPages}
              {...context}
            />
            <NextButton
              currentPage={currentPageIndex}
              totalPages={totalPages}
              {...context}
            />
          </React.Fragment>
        ) : null}
        <SubmitButton
          currentPage={currentPageIndex}
          totalPages={totalPages}
          {...context}
        />
      </Form>
    </React.Fragment>
  );
}

UmbracoForm.Form = defaultComponents.Form;
UmbracoForm.FieldType = defaultComponents.FieldType;
UmbracoForm.Page = defaultComponents.Page;
UmbracoForm.Fieldset = defaultComponents.Fieldset;
UmbracoForm.Column = defaultComponents.Column;
UmbracoForm.Field = defaultComponents.Field;
UmbracoForm.SubmitButton = defaultComponents.SubmitButton;
UmbracoForm.NextButton = defaultComponents.NextButton;
UmbracoForm.PreviousButton = defaultComponents.PreviousButton;
UmbracoForm.ValidationSummary = defaultComponents.ValidationSummary;

export type * from "./types";
export default UmbracoForm;
