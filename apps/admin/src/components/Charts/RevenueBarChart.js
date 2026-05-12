import React from 'react'
import Chart from 'react-apexcharts'
import { useColorModeValue } from '@chakra-ui/react'

const formatChartDate = (value) => {
  const [year, month, day] = String(value || '')
    .split('-')
    .map(Number)
  if (!year || !month || !day) return value
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

const RevenueBarChart = ({ data = [] }) => {
  const textColor = useColorModeValue('#111827', 'white')
  const textColorSecondary = useColorModeValue('#64748B', 'gray.400')
  const gridColor = useColorModeValue('#E5E7EB', 'gray.700')

  const chartData = [
    {
      name: 'Revenue',
      data: data.map((item) => Math.round(item.revenue || 0)),
    },
  ]

  const chartOptions = {
    chart: {
      toolbar: { show: false },
      type: 'bar',
      height: '100%',
      animations: { enabled: false },
      fontFamily: 'Inter, sans-serif',
    },
    plotOptions: {
      bar: {
        borderRadius: 6,
        horizontal: false,
        columnWidth: '48%',
      },
    },
    dataLabels: { enabled: false },
    fill: {
      type: 'solid',
      opacity: 0.95,
    },
    colors: ['#FF8A28'],
    xaxis: {
      categories: data.map((item) => formatChartDate(item.date)),
      labels: {
        style: {
          colors: textColorSecondary,
          fontSize: '12px',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 500,
        },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: {
          colors: textColorSecondary,
          fontSize: '12px',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 500,
        },
        formatter: (val) => {
          if (val >= 1000) return `Rs. ${(val / 1000).toFixed(1)}k`
          return `Rs. ${Math.round(val)}`
        },
      },
    },
    grid: {
      borderColor: gridColor,
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
      padding: {
        top: 8,
        right: 8,
        bottom: 0,
        left: 0,
      },
    },
    tooltip: {
      theme: useColorModeValue('light', 'dark'),
      style: {
        fontSize: '12px',
        fontFamily: 'Inter, sans-serif',
      },
      y: {
        formatter: (val) =>
          new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
          }).format(val),
      },
      marker: { show: true },
    },
    legend: { show: false },
  }

  return <Chart options={chartOptions} series={chartData} type="bar" width="100%" height="100%" />
}

export default RevenueBarChart
