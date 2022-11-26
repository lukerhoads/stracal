import Color from 'color'
import { useEffect, useState } from 'react'
import { SketchPicker } from 'react-color'
import GitHubCalendar from 'react-github-contribution-calendar'

const REDIRECT_URI = "http://localhost:3000/redirect"
const HEX_CHECK = /^#([0-9a-f]{3}){1,2}$/i

type Event = {
  average_heartrate: number,
  distance: number,
  elapsed_time: number,
  elev_high: number,
  elev_low: number, 
  sport_type: string,
  start_date: string,
  average_speed: number,
}

type ConcatEvent = {
  evalMetric: number 
  date: string
}

const genDateString = (date: Date) => {
  return date.toISOString().substring(0, 10)
}

function App() {
  const [authenticated, setAuthenticated] = useState(false)
  const [calendarReady, setCalendarReady] = useState(false)
  const [calendarValues, setCalendarValues] = useState({})
  const [mainColor, setMainColor] = useState("")
  const [boxColor, setBoxColor] = useState("")
  const [colorSet, setColorSet] = useState({})
  const [untilString, setUntilString] = useState('')

  const getToken = async (code?: string, refresh?: string) => {
    const baseUrl = `https://www.strava.com/api/v3/oauth/token?client_id=${process.env.REACT_APP_CLIENT_ID}&client_secret=${process.env.REACT_APP_CLIENT_SECRET}`
    const url = baseUrl + (code ? `&code=${code}&grant_type=authorization_code`
      : `&refresh_token=${refresh}&grant_type=refresh_token`)
    
    return await fetch(url, {
      method: "POST",
    }).then(res => res.json()).then(data => {
      window.location.href = "/"
      localStorage.setItem('strava-access-token', data.access_token)
      localStorage.setItem('strava-refresh-token', data.refresh_token)
      setAuthenticated(true)
    })
  }

  const connectStrava = () => {
    window.location.href = `https://www.strava.com/oauth/authorize?client_id=${process.env.REACT_APP_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=read,activity:read_all`
  }

  useEffect(() => {
    if (localStorage.getItem("strava-access-token") !== "undefined" || localStorage.getItem("strava-refresh-token") !== "undefined") {
      setAuthenticated(true)
      return
    }
    const splitUrl = window.location.href.split("&")
    if (splitUrl.length === 1) return
    const code = splitUrl[1].slice(5)
    getToken(code)
  }, [])

  useEffect(() => {
    if (!HEX_CHECK.test(mainColor)) return

    const color = Color(mainColor)
    setColorSet({
      box: boxColor,
      lightest: color.lighten(0.5).hex(),
      lighter: color.lighten(0.25).hex(),
      darker: color.darken(0.25).hex(),
      darkest: color.darken(0.5).hex(),
    })
  }, [mainColor, boxColor])

  const generateCalendar = async () => {
    if (localStorage.getItem("strava-access-token") === "undefined" || localStorage.getItem("strava-refresh-token") === "undefined") {
      connectStrava()
    }
    
    const scores: Record<string, number> = {}
    let maxMetric = 0;
    let minMetric = Number.MAX_VALUE
    const events: ConcatEvent[] = []

    const today = new Date()
    setUntilString(genDateString(today))
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    const oneYearAgoSeconds = Math.floor(oneYearAgo.getTime() / 1000)
    const maxRetries = 2
    let numRetries = 0
    const PAGE_SIZE = 30
    let success = false
    let page = 1
    while (!success && numRetries < maxRetries) {
      const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?access_token=${localStorage.getItem('strava-access-token')}&after=${oneYearAgoSeconds}&page=${page}`)
      if (!res.ok) {
        await getToken(undefined, localStorage.getItem('strava-refresh-token')!)
        numRetries++
        continue
      }

      const data: Event[] = await res.json()
      if (data.length === 0) {
        break 
      } else if (data.length === PAGE_SIZE) {
        page++ 
        continue
      } else if (data.length < PAGE_SIZE) {
        success = true
      }

      data.forEach(event => {
        const startDate = new Date(event.start_date)
        let averageTotalDistance = event.average_speed * event.elapsed_time
        if (event.sport_type.includes("Bike")) {
          averageTotalDistance /= 2
        }
        if (averageTotalDistance > maxMetric) {
          maxMetric = averageTotalDistance
        }
        if (averageTotalDistance < minMetric) {
          minMetric = averageTotalDistance
        }
        events.push({
          evalMetric: averageTotalDistance,
          date: genDateString(startDate)
        })
      })
    }

    const midQuartile = minMetric + (maxMetric - minMetric) / 2
    const upperBottomQuartile = minMetric + (midQuartile - minMetric) / 2 
    const lowerUpperQuartile = maxMetric - (maxMetric - midQuartile) / 2
    events.forEach(event => {
      let accum = 0
      if (scores[event.date]) {
        accum = scores[event.date]
      }
      if (event.evalMetric < upperBottomQuartile) {
        accum += 1
      } else if (event.evalMetric > upperBottomQuartile && event.evalMetric < midQuartile) {
        accum += 2
      } else if (event.evalMetric > midQuartile && event.evalMetric < lowerUpperQuartile) {
        accum += 3
      } else {
        accum += 4
      }
      
      if (accum > 4) {
        accum = 4
      }

      scores[event.date] = accum
    })

    setCalendarValues(scores)
    setCalendarReady(true)
  }

  return (
    <div className="App">
      { authenticated ? (
        <button onClick={() => generateCalendar()}>Generate Calendar</button> 
      ) : (
        <button onClick={() => connectStrava()}>Connect Strava</button>
      )}
      <p>Main Color</p>
      <SketchPicker color={mainColor} onChange={(color, e) => setMainColor(color.hex)} />
      <p>Box Color</p>
      <SketchPicker color={boxColor} onChange={(color, e) => setBoxColor(color.hex)} />
      { calendarReady && <GitHubCalendar values={calendarValues} until={untilString} panelAttributes weekLabelAttributes monthLabelAttributes panelColors={Object.values(colorSet)} /> }
    </div>
  );
}

export default App;
