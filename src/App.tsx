import { useEffect, useState } from 'react'

const REDIRECT_URI = "http://localhost:3000/redirect"
const CLIENT_ID = "97625"
const CLIENT_SECRET = "b8ef57adf5ba17a23d7884067a54181d96cfae64"

function App() {
  const [authenticated, setAuthenticated] = useState(false)
  const [calendarReady, setCalendarReady] = useState(false)
  const [calendarValues, setCalendarValues] = useState({})
  const [untilString, setUntilString] = useState('')

  const getToken = async (code?: string, refresh?: string) => {
    const url = code ? `https://www.strava.com/api/v3/oauth/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&code=${code}&grant_type=authorization_code`
      : `https://www.strava.com/api/v3/oauth/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&refresh_token=${refresh}&grant_type=refresh_token`
    
    return await fetch(url, {
      method: "POST",
    }).then(res => res.json()).then(data => {
      localStorage.setItem('strava-access-token', data.access_token)
      localStorage.setItem('strava-refresh-token', data.refresh_token)
      setAuthenticated(true)
    }).catch(err => {
      console.error("Error: ", err)
      setAuthenticated(false)
    })
  }

  useEffect(() => {
    if (localStorage.getItem('strava-access-token') !== "undefined" && localStorage.getItem('strava-refresh-token') !== "undefined") {
      setAuthenticated(true)
      return
    }

    const spliturl = window.location.href.split("&")
    if (spliturl.length === 1) {
      return
    }
    const code = spliturl[1].slice(5)
    getToken(code)
    window.location.href = "/"
  }, [])

  const connectStrava = () => {
    window.location.href = `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=read`
  }

  const generateCalendar = async () => {
    // only gettoken if current one invalid
    const today = new Date()
    setUntilString(`${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`)
    const oneYearAgo = today.setFullYear(today.getFullYear() - 1)
    let success = false
    const maxRetries = 1
    let numRetries = 0
    while (!success && numRetries < maxRetries) {
      console.log(localStorage.getItem('strava-access-token'))
      const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${oneYearAgo.toString()}`, {
        headers: new Headers({
          'Authorization': `Bearer ${localStorage.getItem('strava-access-token')}`
        })
      })
      if (!res.ok) {
        await getToken(undefined, localStorage.getItem('strava-refresh-token')!)
        numRetries++
        continue
      }
      const data = await res.json()
      console.log(data)
      success = true
    }
    
  }

  return (
    <div className="App">
      { authenticated ? (
        <button onClick={() => generateCalendar()}>Generate Calendar</button> 
      ) : <button onClick={() => connectStrava()}>Connect Strava</button> }
      {/* { calendarReady ? <Calendar values={calendarValues} until={untilString} />} */}
    </div>
  );
}

export default App;
