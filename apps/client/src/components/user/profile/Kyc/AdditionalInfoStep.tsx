import { useEffect } from "react";
import { Alert, Box, Button, CircularProgress, Grid, Stack, Typography } from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import type {
  BusinessStructure,
  CompanyType,
} from "../../../../types/generic.types";
import FileUploader from "../../../UI/uploader/FileUploader";
import CustomInput from "../../../UI/inputs/CustomInput";
import AadhaarCard from "../../../UI/AadharCard";
import BankChequeCard from "../../../UI/BankChequeCard";
import {
  requiredKycDetails,
  requiredKycFieldMap,
} from "../../../../utils/constants";
import React from "react";
import { useKycTextExtractor } from "../../../../hooks/User/useTextExtractor";

export interface AdditionalKYCForm {
  gstin?: string;
  cin?: string;
  aadhaarUrl?: string;
  aadhaarMime?: string;
  businessPanUrl?: string;
  businessPanMime?: string;
  companyAddressProofUrl?: string;
  companyAddressProofMime?: string;
  gstCertificateUrl?: string;
  gstCertificateMime?: string;
  panCardUrl?: string;
  panCardMime?: string;
  partnershipDeedUrl?: string;
  partnershipDeedMime?: string;
  boardResolutionUrl?: string;
  boardResolutionMime?: string;
  llpAgreementUrl?: string;
  llpAgreementMime?: string;

  cancelledChequeUrl?: string;
  cancelledChequeMime?: string;
}

interface Props {
  structure?: BusinessStructure;
  companyType?: CompanyType;
  defaultValue?: Partial<AdditionalKYCForm>;
  onComplete: (data?: AdditionalKYCForm) => void;
}

const fieldLabels: Partial<Record<keyof AdditionalKYCForm, string>> = {
  panCardUrl: "Upload PAN Card",
  gstin: "GSTIN (Tax ID)",
  cin: "CIN (Corporate Identification Number)",
  gstCertificateUrl: "Upload GST Certificate",
  aadhaarUrl: "Upload Your Aadhaar Card",
  partnershipDeedUrl: "Upload Partnership Deed",
  businessPanUrl: "Upload Business PAN",
  companyAddressProofUrl: "Upload Company Address Proof",
  boardResolutionUrl: "Upload Board Resolution",
  cancelledChequeUrl: "Upload Cancelled Cheque",
  llpAgreementUrl: "Upload LLP Agreement",
};

const inputPlaceholders: Partial<Record<keyof AdditionalKYCForm, string>> = {
  gstin: "Enter your 15-digit GSTIN",
  cin: "Enter your 21-character CIN",
};

const pdfAccept = ".pdf,application/pdf,application/x-pdf";
const imagePdfAccept =
  ".jpg,.jpeg,.png,image/jpeg,image/png,.pdf,application/pdf,application/x-pdf";

const allowedMimeTypes: Partial<Record<keyof AdditionalKYCForm, string>> = {
  aadhaarUrl: imagePdfAccept,
  panCardUrl: imagePdfAccept,
  cancelledChequeUrl: imagePdfAccept,
  partnershipDeedUrl: pdfAccept,
  boardResolutionUrl: pdfAccept,
  llpAgreementUrl: pdfAccept,
  companyAddressProofUrl: imagePdfAccept,
  businessPanUrl: imagePdfAccept,
  gstCertificateUrl: imagePdfAccept,
};

const isFileField = (f: keyof AdditionalKYCForm) =>
  [
    "aadhaarUrl",
    "panCardUrl",
    "partnershipDeedUrl",
    "boardResolutionUrl",
    "llpAgreementUrl",
    "companyAddressProofUrl",
    "boardResolution",
    "cancelledChequeUrl",
    "businessPanUrl",
    "msmeCert",
    "gstCertificateUrl",
  ]?.includes(f);

type ScanType = "aadhar" | "bankCheque" | "pan" | "gst";

const scanTypes: Partial<Record<keyof AdditionalKYCForm, ScanType>> = {
  aadhaarUrl: "aadhar",
  cancelledChequeUrl: "bankCheque",
  panCardUrl: "pan",
  businessPanUrl: "pan",
  gstCertificateUrl: "gst",
};

const scanLabels: Partial<Record<keyof AdditionalKYCForm, string>> = {
  aadhaarUrl: "Scan Aadhaar",
  cancelledChequeUrl: "Scan cheque",
  panCardUrl: "Scan PAN",
  businessPanUrl: "Scan business PAN",
  gstCertificateUrl: "Scan GST certificate",
};

const isScanSupported = (mime?: string) =>
  !mime ||
  mime.startsWith("image/") ||
  ["application/pdf", "application/x-pdf", "application/octet-stream"].includes(mime);

const mimeFieldByUploadField: Partial<
  Record<keyof AdditionalKYCForm, keyof AdditionalKYCForm>
> = {
  aadhaarUrl: "aadhaarMime",
  panCardUrl: "panCardMime",
  cancelledChequeUrl: "cancelledChequeMime",
  partnershipDeedUrl: "partnershipDeedMime",
  boardResolutionUrl: "boardResolutionMime",
  llpAgreementUrl: "llpAgreementMime",
  companyAddressProofUrl: "companyAddressProofMime",
  businessPanUrl: "businessPanMime",
  gstCertificateUrl: "gstCertificateMime",
};

const getFieldLabel = (field: keyof AdditionalKYCForm) =>
  fieldLabels[field] ?? String(field);

export default function AdditionalDetailsStep({
  structure = "individual",
  defaultValue,
  companyType,
  onComplete,
}: Props) {
  const { extractedText, loadingKey, errorKey, extract } = useKycTextExtractor();
  const {
    control,
    setValue,
    handleSubmit,
    watch,
    formState: { isValid },
  } = useForm<AdditionalKYCForm>({
    defaultValues: defaultValue ?? {},
    mode: "onChange",
  });

  const requiredFields: (keyof AdditionalKYCForm)[] = React.useMemo(() => {
    const config = requiredKycDetails[structure];

    if (
      structure === "company" &&
      companyType &&
      typeof config === "object" &&
      !Array.isArray(config)
    ) {
      return config[companyType as CompanyType] ?? [];
    }

    if (Array.isArray(config)) {
      return config;
    }

    return [];
  }, [structure, companyType]);

  const filePlaceholder = (field: keyof AdditionalKYCForm) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    watch(`${field}_key` as any);

  useEffect(() => {
    // Populate _key fields from URL if available
    requiredFields.forEach((field) => {
      const url = defaultValue?.[field];
      const keyField = `${field}_key` as keyof AdditionalKYCForm;

      if (url && !watch(keyField)) {
        const originalName = decodeURIComponent(
          url.split("/").pop() ?? "Uploaded file"
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setValue(keyField as any, originalName);
      }
    });
  }, []);

  const getStatus = (field: keyof AdditionalKYCForm) =>
    defaultValue?.[
      `${field.replace("Url", "")}Status` as keyof typeof defaultValue
    ] as string | undefined;

  const getRejectionReason = (field: keyof AdditionalKYCForm) =>
    defaultValue?.[
      `${field.replace("Url", "")}RejectionReason` as keyof typeof defaultValue
    ] as string | undefined;

  const scanUploadedFile = async (
    field: keyof AdditionalKYCForm,
    fileKey?: string,
    mime?: string
  ) => {
    const scanType = scanTypes[field];
    if (!scanType || !fileKey || !isScanSupported(mime)) return;
    await extract(field, fileKey, scanType);
  };

  const renderScanResult = (field: keyof AdditionalKYCForm) => {
    const result = extractedText[field as string];
    if (!result) return null;

    if (field === "aadhaarUrl") {
      return <AadhaarCard text={result} />;
    }

    if (field === "cancelledChequeUrl") {
      return <BankChequeCard text={result} />;
    }

    if (typeof result === "object" && result !== null) {
      const entries = Object.entries(result as Record<string, unknown>).filter(([, value]) =>
        Boolean(value)
      );

      return (
        <Alert severity={entries.length ? "success" : "info"} sx={{ mt: 1 }}>
          <Stack spacing={0.4}>
            <Typography variant="caption" fontWeight={700}>
              Document scan complete
            </Typography>
            {entries.length ? (
              entries.map(([key, value]) => (
                <Typography key={key} variant="caption">
                  {key}: {String(value)}
                </Typography>
              ))
            ) : (
              <Typography variant="caption">No matching fields were detected.</Typography>
            )}
          </Stack>
        </Alert>
      );
    }

    return (
      <Alert severity="success" sx={{ mt: 1 }}>
        <Typography variant="caption">{String(result)}</Typography>
      </Alert>
    );
  };

  return (
    <Box component="form" onSubmit={handleSubmit(onComplete)}>
      <Typography variant="h6" mb={2}>
        Confirm KYC Details
      </Typography>
      {requiredFields.length === 0 ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          No document upload is required right now. Submit to finish KYC instantly.
        </Alert>
      ) : null}
      <Grid container spacing={3}>
        {requiredFields.map((field) => (
          <Grid key={field} size={{ md: 6, xs: 12 }}>
            {isFileField(field) ? (
              <Controller
                name={field}
                control={control}
                rules={{
                  required:
                    structure === "company" && companyType
                      ? (
                          requiredKycFieldMap[structure] as Record<
                            CompanyType,
                            Partial<Record<keyof AdditionalKYCForm, boolean>>
                          >
                        )[companyType]?.[field] ?? false
                      : (
                          requiredKycFieldMap[structure] as Partial<
                            Record<keyof AdditionalKYCForm, boolean>
                          >
                        )?.[field] ?? false
                      ? `${getFieldLabel(field)} is required`
                      : false,
                  ...(field === "gstin"
                    ? {
                        pattern: {
                          value:
                            /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
                          message:
                            "Invalid GSTIN format. Must be 15 characters (e.g., 22ABCDE1234F1Z5)",
                        },
                      }
                    : {}),
                }}
                render={({ field: ctrl, fieldState }) => {
                  const isRequired =
                    structure === "company" && companyType
                      ? (
                          requiredKycFieldMap[structure] as Record<
                            CompanyType,
                            Partial<Record<keyof AdditionalKYCForm, boolean>>
                          >
                        )[companyType]?.[field] ?? false
                      : (
                          requiredKycFieldMap[structure] as Partial<
                            Record<keyof AdditionalKYCForm, boolean>
                          >
                        )?.[field] ?? false;

                  return (
                    <Stack mt={1.5}>
                      <FileUploader
                        required={isRequired}
                        folderKey="kyc"
                        fullWidth
                        showAccept={Boolean(filePlaceholder(field)) === false}
                        accept={allowedMimeTypes[field]}
                        maxSizeMb={20}
                        variant="button"
                        label={getFieldLabel(field)}
                        placeholder={filePlaceholder(field) as string}
                        onUploaded={async (files) => {
                          const file = files?.[0];
                          const fileKey = file?.key ?? "";
                          setValue(field, fileKey, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          setValue(`${field}_key` as any, file?.originalName ?? "", {
                            shouldDirty: true,
                          });
                          const mimeField = mimeFieldByUploadField[field];
                          if (mimeField) {
                            setValue(mimeField, file?.mime ?? "", {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                          }
                          ctrl.onChange(fileKey);
                          void scanUploadedFile(field, fileKey, file?.mime);
                        }}
                      />
                      {scanTypes[field] ? (
                        <Stack mt={1} spacing={0.8}>
                          <Box display="flex" justifyContent="flex-end">
                            <Button
                              size="small"
                              variant="text"
                              disabled={!watch(field) || loadingKey === field}
                              onClick={() =>
                                void scanUploadedFile(field, watch(field) as string)
                              }
                              startIcon={
                                loadingKey === field ? <CircularProgress size={14} /> : undefined
                              }
                              sx={{ textTransform: "none", fontWeight: 700 }}
                            >
                              {loadingKey === field
                                ? "Scanning..."
                                : scanLabels[field] ?? "Scan document"}
                            </Button>
                          </Box>
                          {errorKey[field] ? (
                            <Alert severity="warning">{errorKey[field]}</Alert>
                          ) : null}
                          {renderScanResult(field)}
                        </Stack>
                      ) : null}
                      {!watch(field) || watch(field) === defaultValue?.[field]
                        ? (() => {
                            const status = getStatus(field);
                            const reason = getRejectionReason(field);
                            if (status === "rejected") {
                              return (
                                <Typography
                                  variant="caption"
                                  color="error"
                                  mt={0.5}
                                >
                                  Rejected: {reason || "No reason provided"}
                                </Typography>
                              );
                            } else if (status === "verified") {
                              return (
                                <Typography
                                  variant="caption"
                                  color="success.main"
                                  mt={0.5}
                                >
                                  ✅ Verified
                                </Typography>
                              );
                            } else if (status === "verification_in_progress") {
                              return (
                                <Typography
                                  variant="caption"
                                  color="info.main"
                                  mt={0.5}
                                >
                                  ⏳ Verification in progress
                                </Typography>
                              );
                            }
                            return null;
                          })()
                        : null}
                      {fieldState.error && (
                        <Typography variant="caption" color="error">
                          {fieldState.error.message}
                        </Typography>
                      )}
                    </Stack>
                  );
                }}
              />
            ) : (
              <Controller
                name={field}
                control={control}
                rules={(() => {
                  const isRequired =
                    structure === "company" && companyType
                      ? (
                          requiredKycFieldMap[structure] as Record<
                            CompanyType,
                            Partial<Record<keyof AdditionalKYCForm, boolean>>
                          >
                        )[companyType]?.[field] ?? false
                      : (
                          requiredKycFieldMap[structure] as Partial<
                            Record<keyof AdditionalKYCForm, boolean>
                          >
                        )?.[field] ?? false;

                  return {
                    required: isRequired ? `${getFieldLabel(field)} is required` : false,
                    ...(field === "gstin"
                      ? {
                          validate: (value?: string) =>
                            !value ||
                            /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(
                              value
                            ) ||
                            "Invalid GSTIN format. Must be 15 characters (e.g., 22ABCDE1234F1Z5)",
                        }
                      : {}),
                  };
                })()}
                render={({ field: ctrl, fieldState }) => (
                  <CustomInput
                    {...ctrl}
                    required={
                      (structure === "company" && companyType
                        ? (
                            requiredKycFieldMap[structure] as Record<
                              CompanyType,
                              Partial<Record<keyof AdditionalKYCForm, boolean>>
                            >
                          )[companyType]?.[field] ?? false
                        : (
                            requiredKycFieldMap[structure] as Partial<
                              Record<keyof AdditionalKYCForm, boolean>
                            >
                          )?.[field] ?? false)
                    }
                    fullWidth
                    label={getFieldLabel(field)}
                    placeholder={
                      inputPlaceholders[field] ?? `Enter ${getFieldLabel(field)}`
                    }
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            )}
          </Grid>
        ))}
      </Grid>

      {/* Submit Button */}
      <Box mt={4} display="flex" justifyContent="flex-end">
        <Button variant="contained" type="submit" disabled={requiredFields.length > 0 && !isValid}>
          {requiredFields.length === 0 ? "Finish KYC" : "Submit KYC"}
        </Button>
      </Box>
    </Box>
  );
}
