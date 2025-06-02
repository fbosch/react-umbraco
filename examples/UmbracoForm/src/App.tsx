import { createPortal } from "react-dom";
import React from 'react'
import clsx from "clsx";

import {
  DefaultFieldType,
  type FormDto,
  UmbracoForm,
  umbracoFormToZodSchema,
} from '@charlietango/react-umbraco/forms';

import formDefinition from "./form-definition";

const form = formDefinition as unknown as FormDto;

const schema = umbracoFormToZodSchema(form);

function App() {
  const summaryRef = React.useRef<HTMLDivElement | null>(null);
  const [sentForm, setSentForm] = React.useState<Object | undefined>();
  return (
    <div className="p-4">
      {sentForm ? (
        <div className="space-y-4 mb-4">
          {form?.messageOnSubmit}
          <pre>{JSON.stringify(sentForm, null, 2)}</pre>
        </div>
      ) : (
        <UmbracoForm
          form={form}
          config={{
            schema,
            shouldValidate: true,
            validateMode: "onSubmit",
            reValidateMode: "onChange",
          }}
          renderValidationSummary={(props) =>
            createPortal(
              <UmbracoForm.ValidationSummary {...props} />,
              summaryRef.current ?? document.body,
            )
          }
          renderPage={(props) => (
            <div className="space-y-4 mb-4">
              <UmbracoForm.Page {...props} />
            </div>
          )}
          renderColumn={(props) => (
            <div className="space-y-6">
              <UmbracoForm.Column {...props} />
            </div>
          )}
          renderField={(props) => (
            <div className="grid">
              <UmbracoForm.Field {...props} />
            </div>
          )}
          renderFieldType={(props) => (
            <UmbracoForm.FieldType
              {...props}
              className={clsx("", {
                rounded: props.field?.type?.name !== "Single choice",
                  ['w-fit']: props?.field?.type?.id === DefaultFieldType.Checkbox || props?.field?.type?.id === DefaultFieldType.DataConsent
              })}
            />
          )}
          renderSubmitButton={(props) => (
            <React.Fragment>
              <div id="summary" ref={summaryRef} />
              <UmbracoForm.SubmitButton {...props} />
            </React.Fragment>
          )}
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const formData = new FormData(form);
            setSentForm(formData); // POST: /umbraco/forms/api/v1/entries/${form.id}
          }}
        />
      )}
    </div>
  );
}

export default App;
