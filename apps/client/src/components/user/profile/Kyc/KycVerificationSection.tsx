import { Box, Button, Container, Grid, Paper, Step, StepLabel, Stepper } from '@mui/material'
import { useQueryClient } from '@tanstack/react-query'
import React, { useEffect, useRef, useState } from 'react'
import { IoChevronBack, IoChevronForward } from 'react-icons/io5'
import { uploadFileToStorage } from '../../../../api/upload.api'
import { useSubmitKyc } from '../../../../hooks/User/Kyc/UseKyc'
import type { BusinessStructure, CompanyType } from '../../../../types/generic.types'
import type { KycDetails } from '../../../../types/user.types'
import { dataUrlToFile } from '../../../../utils/functions'
import { toast } from '../../../UI/Toast'
import AdditionalDetailsStep, { type AdditionalKYCForm } from './AdditionalInfoStep'
import { BusinessStructureStep } from './BusinessStructureStep'
import ImageCaptureStep from './ImageCaptureStep'

const steps = ['Business Structure', 'Selfie', 'Additional Details']

const getInitialStep = (details?: Partial<KycDetails> | null) => {
  if (!details?.structure || (details.structure === 'company' && !details.companyType)) {
    return 0
  }

  if (!details.selfieUrl) {
    return 1
  }

  return 2
}

const isStepReady = (step: number, details?: Partial<KycDetails> | null) => {
  if (step === 0) {
    return Boolean(details?.structure) && (details?.structure !== 'company' || Boolean(details?.companyType))
  }

  if (step === 1) {
    return Boolean(details?.selfieUrl)
  }

  return true
}

const KYCVerificationStep: React.FC<{
  editing?: boolean
  onCancelEdit?: () => void
  onComplete?: () => void
  existingKyc?: KycDetails | null
}> = ({ editing = false, onCancelEdit, onComplete, existingKyc = null }) => {
  const queryClient = useQueryClient()
  const { mutateAsync, isPending } = useSubmitKyc()

  const [activeStep, setActiveStep] = useState(0)
  const [kycData, setKycData] = useState<Partial<KycDetails>>({})
  const kycDataRef = useRef<Partial<KycDetails>>({})
  const [isStepValid, setIsStepValid] = useState(false)

  const updateKycData = (newData: Partial<KycDetails>) => {
    const updated = { ...kycDataRef.current, ...newData }
    kycDataRef.current = updated
    setKycData(updated)
  }

  // Prefill when editing mode is on
  useEffect(() => {
    if (!existingKyc) return

    const initial = { ...existingKyc }
    const nextStep = editing ? 0 : getInitialStep(initial)

    setKycData(initial)
    kycDataRef.current = initial
    setActiveStep(nextStep)
    setIsStepValid(isStepReady(nextStep, initial))
  }, [editing, existingKyc])

  const handleBusinessStructureChange = (value: BusinessStructure | CompanyType, key: string) => {
    const nextData: Partial<KycDetails> = {
      ...(key === 'structure' ? { structure: value as BusinessStructure } : {}),
      ...(key === 'companyType' ? { companyType: value as CompanyType } : {}),
    }

    if (key === 'structure' && value !== 'company') {
      nextData.companyType = undefined
    }

    updateKycData(nextData)

    const updated = { ...kycDataRef.current, ...nextData }
    setIsStepValid(
      Boolean(updated.structure) &&
        (updated.structure !== 'company' || Boolean(updated.companyType)),
    )
  }

  const handleSelfieCapture = (img: string) => {
    updateKycData({ selfieUrl: img })
    setIsStepValid(true)
  }

  const handleAdditionalInfoChange = async (value: AdditionalKYCForm) => {
    updateKycData(value)
    setIsStepValid(true)
  }

  const handleFinalSubmit = async (data: AdditionalKYCForm) => {
    await handleAdditionalInfoChange(data)
    handleNext({ ...kycDataRef.current, ...data })
  }

  useEffect(() => {
    if (kycData?.selfieUrl) setIsStepValid(true)
  }, [kycData?.selfieUrl])

  const handleNext = async (overrideData?: Partial<KycDetails>) => {
    const data = overrideData ?? kycDataRef.current

    if (
      activeStep === 0 &&
      (!data.structure || (data?.structure === 'company' && !data?.companyType))
    ) {
      toast.open({ message: 'Select a business structure to continue.', severity: 'warning' })
      return
    }

    if (activeStep === 1 && !data.selfieUrl) {
      toast.open({ message: 'Capture a selfie to continue.', severity: 'warning' })
      return
    }

    if (isStepValid && activeStep === 2) {
      try {
        toast.open({ message: 'Submitting KYC details...', severity: 'info' })

        let selfieUrl = data?.selfieUrl ?? ''
        let selfieMime = data?.selfieMime

        if (selfieUrl.startsWith('data:image')) {
          const file = dataUrlToFile(selfieUrl, 'selfie.jpg')
          selfieMime = file.type

          if (file.size / 1024 / 1024 > 5) {
            throw new Error('Selfie exceeds 5MB limit')
          }

          const uploaded = await uploadFileToStorage({
            file,
            folderKey: 'kyc',
          })

          selfieUrl = uploaded.key
        }

        const result = await mutateAsync({
          details: {
            ...data,
            selfieUrl,
            ...(selfieMime ? { selfieMime } : {}),
          },
        })

        toast.open({
          message: result?.message ?? 'KYC details submitted successfully!',
          severity: 'success',
        })

        queryClient.invalidateQueries({ queryKey: ['userKyc'] })
        queryClient.invalidateQueries({ queryKey: ['userProfile'] })

        if (onComplete) {
          onComplete()
        } else {
          setActiveStep((prev) => Math.min(prev + 1, steps.length - 1))
        }
      } catch (err: any) {
        toast.open({
          message: err?.response?.data?.message ?? err?.message ?? 'Failed to submit KYC details',
          severity: 'error',
        })

        if (data.selfieUrl?.startsWith('data:image')) {
          updateKycData({ selfieUrl: undefined })
        }

        setIsStepValid(false)
      }

      return
    }

    setActiveStep((prev) => Math.min(prev + 1, steps.length - 1))
  }

  const handleBack = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0))
    setIsStepValid(true)
  }

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <BusinessStructureStep
            defaultValue={{
              structure: kycData.structure,
              companyType: kycData.companyType ?? undefined,
            }}
            value={{
              structure: kycData.structure,
              companyType: kycData.companyType ?? undefined,
            }}
            onChange={handleBusinessStructureChange}
          />
        )
      case 1:
        return <ImageCaptureStep img={kycData?.selfieUrl ?? ''} onCapture={handleSelfieCapture} />
      default:
        return (
          <AdditionalDetailsStep
            structure={kycData?.structure}
            companyType={kycData?.companyType}
            defaultValue={kycData}
            onComplete={(data) => handleFinalSubmit(data ?? {})}
          />
        )
    }
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4 }}>
      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 9 }} order={{ md: 1, xs: 2 }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, md: 3 },
              borderRadius: 3,
              bgcolor: '#FFFFFF',
              border: '1px solid #E0E6ED',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, #333369 0%, #3DD598 100%)',
                borderRadius: '12px 12px 0 0',
              },
            }}
          >
            <Box display="flex" mb={3} justifyContent="space-between" alignItems="center">
              <Button
                variant="outlined"
                onClick={handleBack}
                startIcon={<IoChevronBack />}
                disabled={activeStep === 0}
                sx={{
                  borderColor: '#E0E6ED',
                  color: '#333369',
                  fontWeight: 600,
                  '&:hover': {
                    bgcolor: '#F5F7FA',
                    borderColor: '#333369',
                  },
                }}
              >
                Back
              </Button>

              <Box display="flex" gap={2}>
                {editing && (
                  <Button
                    variant="outlined"
                    onClick={onCancelEdit}
                    sx={{
                      borderColor: '#E0E6ED',
                      color: '#E74C3C',
                      fontWeight: 600,
                      '&:hover': {
                        bgcolor: 'rgba(231, 76, 60, 0.1)',
                        borderColor: '#E74C3C',
                      },
                    }}
                  >
                    Cancel Editing
                  </Button>
                )}

                {activeStep !== steps.length - 1 ? (
                  <Button
                    variant="contained"
                    onClick={() => {
                      void handleNext()
                    }}
                    disabled={!isStepValid || isPending}
                    endIcon={<IoChevronForward />}
                    sx={{
                      fontWeight: 600,
                      boxShadow: '0 4px 12px rgba(51, 51, 105, 0.2)',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: '0 6px 16px rgba(51, 51, 105, 0.3)',
                      },
                      transition: 'all 0.3s ease',
                    }}
                  >
                    Next
                  </Button>
                ) : null}
              </Box>
            </Box>
            {renderStepContent()}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 3 }} order={{ md: 2, xs: 1 }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, md: 3 },
              borderRadius: 3,
              bgcolor: '#FFFFFF',
              border: '1px solid #E0E6ED',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              position: 'sticky',
              top: 24,
            }}
          >
            <Stepper
              activeStep={activeStep}
              orientation="vertical"
              sx={{
                '& .MuiStepLabel-label': {
                  color: '#4A5568',
                  fontWeight: 500,
                  '&.Mui-active': {
                    color: '#333369',
                    fontWeight: 700,
                  },
                  '&.Mui-completed': {
                    color: '#3DD598',
                    fontWeight: 600,
                  },
                },
                '& .MuiStepIcon-root': {
                  color: '#E0E6ED',
                  '&.Mui-active': {
                    color: '#333369',
                  },
                  '&.Mui-completed': {
                    color: '#3DD598',
                  },
                },
              }}
            >
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  )
}

export default KYCVerificationStep
