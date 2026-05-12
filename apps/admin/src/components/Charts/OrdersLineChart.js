import React from 'react'
import ReactApexChart from 'react-apexcharts'
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

const OrdersLineChart = ({ data = [] }) => {
  const textColorSecondary = useColorModeValue('#64748B', 'gray.400')
  const gridColor = useColorModeValue('#E5E7EB', 'gray.700')

  const chartData = [
    {
      name: 'Orders',
      data: data.map((item) => item.orders || 0),
    },
  ]

  const chartOptions = {
    chart: {
      toolbar: { show: false },
      type: 'area',
      height: '100%',
      zoom: { enabled: false },
      animations: { enabled: false },
      fontFamily: 'Inter, sans-serif',
    },
    dataLabels: { enabled: false },
    stroke: {
      curve: 'smooth',
      width: 3,
      lineCap: 'round',
      colors: ['#FF8A28'],
    },
    fill: {
      type: 'gradient',
      gradient: {
        shade: 'light',
        type: 'vertical',
        opacityFrom: 0.22,
        opacityTo: 0,
        stops: [0, 100],
      },
    },
    colors: ['#FF8A28'],
    markers: {
      size: 0,
      hover: { size: 5 },
    },
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
        formatter: (val) => Math.round(val).toString(),
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
      y: { formatter: (val) => `${val} orders` },
      marker: { show: true },
    },
    legend: { show: false },
  }

  return (
    <ReactApexChart
      options={chartOptions}
      series={chartData}
      type="area"
      width="100%"
      height="100%"
    />
  )
}

export default OrdersLineChart
