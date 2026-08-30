import { useAwayTitle } from './hooks/usePageVisibility'


export default function App() {

  useAwayTitle()
  useAwayTitle({ home: 'Example.Ex', label: 'On hold' });

}
