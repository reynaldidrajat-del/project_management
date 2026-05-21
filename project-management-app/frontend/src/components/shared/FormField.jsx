// Wrapper field form agar label, hint, error, dan input punya tampilan konsisten.
function FormField({ label, htmlFor, required = false, hint, error, className = '', children }) {
  return (
    <div className={className}>
      {label ? (
        <label className="label" htmlFor={htmlFor}>
          {label}
          {required ? <span className="ml-1 text-danger">*</span> : null}
        </label>
      ) : null}
      {hint ? <p className="form-hint">{hint}</p> : null}
      {children}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}

export default FormField;
